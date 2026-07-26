import { z } from "zod";
import { generateLlmText, getLlmClient } from "@/lib/llm/client";
import { parseLlmJson } from "@/lib/llm/json-output";
import { coerceReagentParsedPayload, coerceVerifiedReagentPayload, normalizeLlmParsedPayload } from "@/lib/llm/normalize";
import { buildReagentParsePrompt } from "@/lib/llm/prompts/reagent-parse";
import { buildReagentVerifyPrompt } from "@/lib/llm/prompts/reagent-verify";
import { getNativeWebSearchToolType } from "@/lib/llm/model-capabilities";
import type { RuntimeLlmConfig } from "@/lib/llm/runtime-config";
import { reagentParsedSchema, verifiedReagentParsedSchema } from "@/lib/llm/schemas";
import { retrieveReagentKnowledgeRuntime } from "@/lib/reagent-knowledge/runtime";
import type { ReagentKnowledgeRetrievalResult } from "@/lib/reagent-knowledge/types";
import { buildHeuristicParse } from "@/lib/reagent-tagging";
import { fetchVerificationPages, type VerificationPage } from "@/lib/reagent-ingest/fetch-verification-pages";
import { isExternalSearchConfigured, searchReagentWeb } from "@/lib/reagent-ingest/web-search";
import { withTimeout } from "@/lib/async/with-timeout";
import { finalizeAiFlow, prepareAiFlow } from "@/lib/ai-orchestrator/run-flow";
import type { AiFlowContext, AiFlowExecution } from "@/lib/ai-orchestrator/types";
import { invokeMcpTool } from "@/lib/mcp/client";
import { buildReagentSkillHints } from "@/lib/skills/builtin/reagent-classification-curator";
import { REAGENT_PARSE_OUTPUT_SKILL_ID } from "@/lib/skills/builtin/reagent-parse-output";
import { cleanUrlText } from "@/lib/url/clean-url";

export type ParseReagentInput = {
  name: string;
  catalogNo: string;
  note?: string | null;
  lang: "zh" | "en";
};

export type ParseReagentResult = {
  parsed: z.infer<typeof verifiedReagentParsedSchema>;
  parseSource: "llm" | "fallback";
  verificationStatus: "verified" | "unverified";
  verificationMethod: "native_web_search" | "external_search" | "knowledge_base" | "none";
  verificationReason: z.infer<typeof verifiedReagentParsedSchema>["verification"]["reason"];
  verificationWarnings: string[];
  rawLlmOutput?: string;
  ai?: {
    enabledSkills: string[];
    enabledMcpServers: string[];
    selfCheck: { ok: boolean; score: number; warnings: string[] };
    canAutoLearn: boolean;
    learningStatus?: string;
    learningLogId?: string;
  };
  diagnostics?: ParseReagentDiagnostics;
};

export type ParseReagentDiagnostics = {
  path: "native_verified" | "knowledge_verified" | "initial_draft_only" | "external_verified" | "fallback";
  timingsMs: Partial<Record<"retrieval" | "prepareFlow" | "initialDraft" | "nativeVerify" | "externalSearch" | "externalVerify" | "finalize", number>>;
  degradedStages: string[];
};

type ParseReagentDependencies = {
  client?: ReturnType<typeof getLlmClient>;
  searchWeb?: (query: string) => ReturnType<typeof searchReagentWeb>;
  fetchPages?: typeof fetchVerificationPages;
  llmConfig?: RuntimeLlmConfig;
  flowContext?: AiFlowContext;
};

// Reasoning models (MiniMax-M1, MiMo, DeepSeek-R1, o-series) routinely need
// 20-60s per call; tighter budgets used to push good drafts into fallback.
const INITIAL_DRAFT_TIMEOUT_MS = 45000;
const NATIVE_VERIFY_TIMEOUT_MS = 45000;
const EXTERNAL_VERIFY_TIMEOUT_MS = 30000;
const FINALIZE_FLOW_TIMEOUT_MS = 5000;

// 本地知识库置信度达到阈值时，草稿直接按"知识库核验"定稿，
// 跳过串行链路里最贵的联网搜索+抓取+二次模型验证。
const DEFAULT_KNOWLEDGE_VERIFY_THRESHOLD = 0.9;

type LlmCallConfig = {
  model: string;
  baseUrl: string | null | undefined;
  thinkingEnabled: boolean;
};

function knowledgeVerifyThreshold() {
  const raw = Number.parseFloat(process.env.LLM_KNOWLEDGE_VERIFY_THRESHOLD ?? "");
  return Number.isFinite(raw) ? raw : DEFAULT_KNOWLEDGE_VERIFY_THRESHOLD;
}

function shouldSkipWebVerification(
  llmConfig: ParseReagentDependencies["llmConfig"],
  retrievalConfidence: number,
) {
  const enabled = llmConfig?.knowledgeVerifySkipEnabled ?? true;
  return enabled && retrievalConfidence >= knowledgeVerifyThreshold();
}

function parseDraftFromRawOutput(rawOutput: string) {
  const coerced = coerceReagentParsedPayload(normalizeLlmParsedPayload(parseLlmJson(rawOutput)));
  const parsed = reagentParsedSchema.parse(coerced.payload);
  return { ...parsed, warnings: [...parsed.warnings, ...coerced.warnings] };
}

function parseVerifiedFromRawOutput(rawOutput: string) {
  const coerced = coerceVerifiedReagentPayload(normalizeLlmParsedPayload(parseLlmJson(rawOutput)));
  const parsed = verifiedReagentParsedSchema.parse(coerced.payload);
  return { ...parsed, warnings: [...parsed.warnings, ...coerced.warnings] };
}

function previewText(text: string, limit = 600) {
  return text.length <= limit ? text : `${text.slice(0, limit)}...(truncated)`;
}

function heuristicFallback(input: { name: string; catalogNo?: string; note?: string | null }) {
  return buildHeuristicParse(input) as z.infer<typeof reagentParsedSchema>;
}

function withVerification(
  parsed: z.infer<typeof reagentParsedSchema>,
  verification: z.infer<typeof verifiedReagentParsedSchema>["verification"],
) {
  return verifiedReagentParsedSchema.parse({
    ...parsed,
    warnings: [...(parsed.warnings ?? []), ...(verification.warnings ?? [])],
    verification,
  });
}

function buildVerificationQuery(input: ParseReagentInput) {
  return [input.name, input.catalogNo, input.note].filter(Boolean).join(" ");
}

function buildVerificationPayload(
  parsed: z.infer<typeof reagentParsedSchema>,
  payload: z.infer<typeof verifiedReagentParsedSchema>["verification"],
) {
  return withVerification(parsed, payload);
}

function buildVerificationWarnings(reason: ParseReagentResult["verificationReason"]) {
  switch (reason) {
    case "external_search_unconfigured":
      return ["未配置外部搜索能力，已保留初稿结果。"];
    case "external_search_failed":
      return ["外部搜索请求失败，已保留初稿结果。"];
    case "external_search_no_results":
      return ["未获取到可用外部证据，已保留初稿结果。"];
    case "native_search_no_sources":
      return ["原生联网搜索未返回可用来源，已保留初稿结果。"];
    default:
      return [];
  }
}

function pushDegradedStage(diagnostics: ParseReagentDiagnostics, stage: string) {
  if (!diagnostics.degradedStages.includes(stage)) {
    diagnostics.degradedStages.push(stage);
  }
}

async function generateInitialDraft(
  client: ReturnType<typeof getLlmClient>,
  llm: LlmCallConfig & { structuredOutput: boolean },
  input: ParseReagentInput,
  retrieval: ReagentKnowledgeRetrievalResult,
) {
  const result = await withTimeout(generateLlmText(client, { baseURL: llm.baseUrl, thinkingEnabled: llm.thinkingEnabled }, {
    model: llm.model,
    input: [
      {
        role: "system",
        content: buildReagentParsePrompt(
          input.lang,
          {
            candidateCategories: retrieval.candidateCategories,
            candidateSubCategories: retrieval.candidateSubCategories,
            candidateExperimentTags: retrieval.candidateExperimentTags,
            evidenceLines: retrieval.evidenceLines,
          },
          { structuredOutput: llm.structuredOutput },
        ),
      },
      { role: "user", content: JSON.stringify(input) },
    ],
    temperature: 0,
  }), INITIAL_DRAFT_TIMEOUT_MS, "INITIAL_DRAFT");

  const rawOutput = result.text || "";
  const parsed = parseDraftFromRawOutput(rawOutput);
  return { rawOutput, parsed };
}

async function verifyWithNativeWebSearch(
  client: ReturnType<typeof getLlmClient>,
  llm: LlmCallConfig,
  input: ParseReagentInput,
  initialDraft: z.infer<typeof reagentParsedSchema> | null,
  retrieval: ReagentKnowledgeRetrievalResult,
) {
  const toolType = getNativeWebSearchToolType({ baseUrl: llm.baseUrl, model: llm.model });
  if (!toolType) return null;

  const result = await withTimeout(generateLlmText(client, { baseURL: llm.baseUrl, thinkingEnabled: llm.thinkingEnabled }, {
    model: llm.model,
    input: [
      {
        role: "system",
        content: buildReagentVerifyPrompt({
          lang: input.lang,
          verificationMethod: "native_web_search",
          initialDraft: initialDraft ?? undefined,
          retrievalEvidence: retrieval.evidenceLines,
        }),
      },
      {
        role: "user",
        content: JSON.stringify(input),
      },
    ],
    temperature: 0,
    includeSources: true,
  }), NATIVE_VERIFY_TIMEOUT_MS, "NATIVE_VERIFY");

  const rawOutput = result.text || "";
  const parsed = parseVerifiedFromRawOutput(rawOutput);
  return { rawOutput, parsed, sourceCount: result.sources.length };
}

async function verifyWithExternalEvidence(
  client: ReturnType<typeof getLlmClient>,
  llm: LlmCallConfig,
  input: ParseReagentInput,
  initialDraft: z.infer<typeof reagentParsedSchema> | null,
  retrieval: ReagentKnowledgeRetrievalResult,
  externalEvidence: VerificationPage[],
) {
  const verificationMethod = externalEvidence.length ? "external_search" : "none";
  const result = await withTimeout(generateLlmText(client, { baseURL: llm.baseUrl, thinkingEnabled: llm.thinkingEnabled }, {
    model: llm.model,
    input: [
      {
        role: "system",
        content: buildReagentVerifyPrompt({
          lang: input.lang,
          verificationMethod,
          initialDraft: initialDraft ?? undefined,
          retrievalEvidence: retrieval.evidenceLines,
          externalEvidence,
        }),
      },
      {
        role: "user",
        content: JSON.stringify(input),
      },
    ],
    temperature: 0,
  }), EXTERNAL_VERIFY_TIMEOUT_MS, "EXTERNAL_VERIFY");

  const rawOutput = result.text || "";
  const parsed = parseVerifiedFromRawOutput(rawOutput);
  return { rawOutput, parsed };
}

async function finalizeResult(
  result: ParseReagentResult,
  options: {
    flowContext?: AiFlowContext;
    execution?: AiFlowExecution | null;
    input: ParseReagentInput;
    retrievalConfidence: number;
    evidenceLines: string[];
    sourceCount: number;
  },
): Promise<ParseReagentResult> {
  if (!options.flowContext || !options.execution) {
    return result;
  }

  try {
    const startedAt = Date.now();
    const finalized = await withTimeout(finalizeAiFlow({
      context: options.flowContext,
      domain: "REAGENT",
      entityKey: `${options.input.name}::${options.input.catalogNo}`,
      afterData: result.parsed,
      evidenceLines: options.evidenceLines,
      retrievalConfidence: options.retrievalConfidence,
      sourceCount: options.sourceCount,
      warnings: result.verificationWarnings,
    }), FINALIZE_FLOW_TIMEOUT_MS, "FINALIZE_AI_FLOW");
    if (result.diagnostics) {
      result.diagnostics.timingsMs.finalize = Date.now() - startedAt;
    }

    return {
      ...result,
      ai: {
        enabledSkills: finalized.execution.enabledSkills,
        enabledMcpServers: finalized.execution.enabledMcpServers,
        selfCheck: finalized.selfCheck,
        canAutoLearn: finalized.canAutoLearn,
        learningStatus: finalized.learning?.status,
        learningLogId: finalized.learning?.log?.id,
      },
    };
  } catch (error) {
    if (result.diagnostics) {
      result.diagnostics.timingsMs.finalize ??= 0;
      pushDegradedStage(result.diagnostics, error instanceof Error && error.message.includes("TIMEOUT") ? "finalize_timeout" : "finalize_failed");
    }
    console.error("[reagent-parse] finalize ai flow failed", {
      errorName: error instanceof Error ? error.name : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return result;
  }
}

export async function parseReagentInput(
  input: ParseReagentInput,
  dependencies?: ParseReagentDependencies,
): Promise<ParseReagentResult> {
  let structured: z.infer<typeof verifiedReagentParsedSchema>;
  let parseSource: "llm" | "fallback" = "llm";
  let rawLlmOutput = "";
  const llmConfig = dependencies?.llmConfig;
  const model = llmConfig?.model || process.env.OPENAI_MODEL || "MiniMax-M1-80k";
  const activeBaseUrl = cleanUrlText(llmConfig?.baseURL) ?? cleanUrlText(process.env.OPENAI_BASE_URL);
  const diagnostics: ParseReagentDiagnostics = {
    path: "fallback",
    timingsMs: {},
    degradedStages: [],
  };
  const retrievalStartedAt = Date.now();
  const retrieval = await retrieveReagentKnowledgeRuntime({
    name: input.name,
    catalogNo: input.catalogNo,
    note: input.note ?? undefined,
  });
  diagnostics.timingsMs.retrieval = Date.now() - retrievalStartedAt;
  const prepareFlowStartedAt = Date.now();
  const execution = dependencies?.flowContext ? await prepareAiFlow(dependencies.flowContext) : null;
  diagnostics.timingsMs.prepareFlow = Date.now() - prepareFlowStartedAt;
  const enhancedEvidenceLines =
    execution?.enabledSkills.includes("reagent-classification-curator")
      ? [...retrieval.evidenceLines, ...buildReagentSkillHints(retrieval)]
      : retrieval.evidenceLines;
  const retrievalContext = {
    ...retrieval,
    evidenceLines: enhancedEvidenceLines,
  };
  const llmCall: LlmCallConfig = {
    model,
    baseUrl: activeBaseUrl,
    thinkingEnabled: llmConfig?.thinkingEnabled ?? false,
  };
  // 无 flowContext（如测试、脚本直调）时默认启用结构化输出契约，保持既有输出格式。
  const structuredOutputSkillEnabled = execution
    ? execution.enabledSkills.includes(REAGENT_PARSE_OUTPUT_SKILL_ID)
    : true;
  const searchWeb = dependencies?.searchWeb ?? ((query: string) => searchReagentWeb(query, {
    enabled: llmConfig?.searchEnabled,
    provider: llmConfig?.searchProvider,
    apiKey: llmConfig?.searchApiKey,
    baseURL: llmConfig?.searchBaseURL,
  }));
  const fetchPages = dependencies?.fetchPages ?? fetchVerificationPages;

  try {
    const client = dependencies?.client ?? getLlmClient({ apiKey: llmConfig?.apiKey, baseURL: llmConfig?.baseURL });
    let initialDraft: z.infer<typeof reagentParsedSchema> | null = null;
    let initialError: unknown = null;

    const initialDraftStartedAt = Date.now();
    try {
      const initial = await generateInitialDraft(client, { ...llmCall, structuredOutput: structuredOutputSkillEnabled }, input, retrievalContext);
      diagnostics.timingsMs.initialDraft = Date.now() - initialDraftStartedAt;
      rawLlmOutput = initial.rawOutput;
      initialDraft = initial.parsed;
    } catch (error) {
      diagnostics.timingsMs.initialDraft = Date.now() - initialDraftStartedAt;
      pushDegradedStage(diagnostics, error instanceof Error && error.message.includes("TIMEOUT") ? "initial_draft_timeout" : "initial_draft_failed");
      initialError = error;
      console.error("[reagent-parse] initial draft failed", {
        model,
        errorName: error instanceof Error ? error.name : typeof error,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }

    if (initialDraft && shouldSkipWebVerification(llmConfig, retrieval.retrievalConfidence)) {
      structured = buildVerificationPayload(initialDraft, {
        status: "verified",
        method: "knowledge_base",
        reason: "knowledge_base_hit",
        warnings: [`本地知识库高置信命中（置信度 ${retrieval.retrievalConfidence.toFixed(2)}），已跳过联网验证。`],
      });
      diagnostics.path = "knowledge_verified";
      return finalizeResult({
        parsed: structured,
        parseSource,
        verificationStatus: structured.verification.status,
        verificationMethod: structured.verification.method,
        verificationReason: structured.verification.reason,
        verificationWarnings: structured.verification.warnings,
        rawLlmOutput: rawLlmOutput || undefined,
        diagnostics,
      }, {
        flowContext: dependencies?.flowContext,
        execution,
        input,
        retrievalConfidence: retrieval.retrievalConfidence,
        evidenceLines: retrievalContext.evidenceLines,
        sourceCount: 0,
      });
    }

    try {
      const startedAt = Date.now();
      const nativeVerified = await verifyWithNativeWebSearch(client, llmCall, input, initialDraft, retrievalContext);
      diagnostics.timingsMs.nativeVerify = Date.now() - startedAt;
      if (nativeVerified) {
        rawLlmOutput = nativeVerified.rawOutput || rawLlmOutput;
        structured = withVerification(nativeVerified.parsed, {
          ...nativeVerified.parsed.verification,
          status: nativeVerified.sourceCount > 0 ? nativeVerified.parsed.verification.status : "unverified",
          reason: nativeVerified.sourceCount > 0 ? nativeVerified.parsed.verification.reason : "native_search_no_sources",
          warnings:
            nativeVerified.sourceCount > 0
              ? nativeVerified.parsed.verification.warnings
              : [...nativeVerified.parsed.verification.warnings, "原生联网搜索未返回可用来源，已降级为未核验状态。"],
        });
        diagnostics.path = "native_verified";
        return finalizeResult({
          parsed: structured,
          parseSource,
          verificationStatus: structured.verification.status,
          verificationMethod: structured.verification.method,
          verificationReason: structured.verification.reason,
          verificationWarnings: structured.verification.warnings,
          rawLlmOutput: rawLlmOutput || undefined,
          diagnostics,
        }, {
          flowContext: dependencies?.flowContext,
          execution,
          input,
          retrievalConfidence: retrieval.retrievalConfidence,
          evidenceLines: retrievalContext.evidenceLines,
          sourceCount: nativeVerified.sourceCount,
        });
      }
    } catch (error) {
      diagnostics.timingsMs.nativeVerify ??= 0;
      pushDegradedStage(diagnostics, error instanceof Error && error.message.includes("TIMEOUT") ? "native_verify_timeout" : "native_verify_failed");
      console.error("[reagent-parse] native verification failed", {
        model,
        errorName: error instanceof Error ? error.name : typeof error,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }

    let verificationPages: VerificationPage[] = [];
    let verificationReason: ParseReagentResult["verificationReason"] = "native_tool_unavailable";
    let externalSearchFailed = false;
    const externalSearchConfigured = dependencies?.searchWeb
      ? true
      : isExternalSearchConfigured({
          enabled: llmConfig?.searchEnabled,
          provider: llmConfig?.searchProvider,
          apiKey: llmConfig?.searchApiKey,
          baseURL: llmConfig?.searchBaseURL,
        });
    try {
      const startedAt = Date.now();
      if (!externalSearchConfigured) {
        verificationReason = "external_search_unconfigured";
      } else {
        const searchResults =
          execution?.enabledMcpServers.includes("search")
            ? await invokeMcpTool("search_web", {
                query: buildVerificationQuery(input),
                config: {
                  enabled: llmConfig?.searchEnabled,
                  provider: llmConfig?.searchProvider,
                  apiKey: llmConfig?.searchApiKey,
                  baseURL: llmConfig?.searchBaseURL,
                },
              })
            : await searchWeb(buildVerificationQuery(input));
        if (searchResults.length) {
          verificationPages =
            execution?.enabledMcpServers.includes("fetch")
              ? await invokeMcpTool("fetch_pages", { results: searchResults, limit: 3 })
              : await fetchPages(searchResults);
          verificationReason = verificationPages.length ? "verified" : "external_search_no_results";
        } else {
          verificationReason = "external_search_no_results";
        }
      }
      diagnostics.timingsMs.externalSearch = Date.now() - startedAt;
    } catch (error) {
      diagnostics.timingsMs.externalSearch ??= 0;
      pushDegradedStage(diagnostics, "external_search_failed");
      externalSearchFailed = true;
      verificationReason = "external_search_failed";
      console.error("[reagent-parse] external search failed", {
        errorName: error instanceof Error ? error.name : typeof error,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }

    if (!verificationPages.length && initialDraft) {
      structured = buildVerificationPayload(initialDraft, {
        status: "unverified",
        method: "none",
        reason: verificationReason,
        warnings: buildVerificationWarnings(verificationReason),
      });
      diagnostics.path = "initial_draft_only";
      if (verificationReason !== "verified") {
        pushDegradedStage(diagnostics, verificationReason);
      }
      return finalizeResult({
        parsed: structured,
        parseSource,
        verificationStatus: structured.verification.status,
        verificationMethod: structured.verification.method,
        verificationReason: structured.verification.reason,
        verificationWarnings: structured.verification.warnings,
        rawLlmOutput: rawLlmOutput || undefined,
        diagnostics,
      }, {
        flowContext: dependencies?.flowContext,
        execution,
        input,
        retrievalConfidence: retrieval.retrievalConfidence,
        evidenceLines: retrievalContext.evidenceLines,
        sourceCount: 0,
      });
    }

    if (!verificationPages.length) {
      parseSource = "fallback";
      structured = withVerification(
        heuristicFallback({
          name: input.name,
          catalogNo: input.catalogNo,
          note: input.note,
        }),
        {
          status: "unverified",
          method: "none",
          reason: "fallback_used",
          warnings: ["未获取到可用外部证据，且模型初稿不可用，已直接使用规则兜底。"],
        },
      );
      diagnostics.path = "fallback";
      pushDegradedStage(diagnostics, verificationReason);
      pushDegradedStage(diagnostics, "fallback_used");
      return finalizeResult({
        parsed: structured,
        parseSource,
        verificationStatus: structured.verification.status,
        verificationMethod: structured.verification.method,
        verificationReason: structured.verification.reason,
        verificationWarnings: structured.verification.warnings,
        rawLlmOutput: rawLlmOutput || undefined,
        diagnostics,
      }, {
        flowContext: dependencies?.flowContext,
        execution,
        input,
        retrievalConfidence: retrieval.retrievalConfidence,
        evidenceLines: retrievalContext.evidenceLines,
        sourceCount: 0,
      });
    }

    const externalVerifyStartedAt = Date.now();
    try {
      const externallyVerified = await verifyWithExternalEvidence(
        client,
        llmCall,
        input,
        initialDraft,
        retrievalContext,
        verificationPages,
      );
      diagnostics.timingsMs.externalVerify = Date.now() - externalVerifyStartedAt;
      rawLlmOutput = externallyVerified.rawOutput || rawLlmOutput;
      structured = withVerification(externallyVerified.parsed, {
        ...externallyVerified.parsed.verification,
        status:
          externallyVerified.parsed.verification.method === "external_search" && verificationPages.length
            ? externallyVerified.parsed.verification.status
            : "unverified",
        method: verificationPages.length ? "external_search" : "none",
        reason:
          verificationPages.length && externallyVerified.parsed.verification.method === "external_search"
            ? externallyVerified.parsed.verification.reason
            : verificationReason,
        warnings:
          verificationPages.length || externallyVerified.parsed.verification.method === "none"
            ? externallyVerified.parsed.verification.warnings
            : [
                ...externallyVerified.parsed.verification.warnings,
                externalSearchConfigured
                  ? externalSearchFailed
                    ? "外部搜索请求失败，结果保留为未核验。"
                    : "未获取到可用外部证据，结果保留为未核验。"
                  : "未配置外部搜索能力，结果保留为未核验。",
              ],
      });
      diagnostics.path = "external_verified";
      return finalizeResult({
        parsed: structured,
        parseSource,
        verificationStatus: structured.verification.status,
        verificationMethod: structured.verification.method,
        verificationReason: structured.verification.reason,
        verificationWarnings: structured.verification.warnings,
        rawLlmOutput: rawLlmOutput || undefined,
        diagnostics,
      }, {
        flowContext: dependencies?.flowContext,
        execution,
        input,
        retrievalConfidence: retrieval.retrievalConfidence,
        evidenceLines: retrievalContext.evidenceLines,
        sourceCount: verificationPages.length,
      });
    } catch (error) {
      diagnostics.timingsMs.externalVerify = Date.now() - externalVerifyStartedAt;
      pushDegradedStage(diagnostics, error instanceof Error && error.message.includes("TIMEOUT") ? "external_verify_timeout" : "external_verify_failed");
      if (initialDraft) {
        structured = buildVerificationPayload(initialDraft, {
          status: "unverified",
          method: "none",
          reason: externalSearchConfigured ? "verification_model_failed" : "external_search_unconfigured",
          warnings: [externalSearchConfigured ? "联网纠错失败，已保留初稿结果。" : "未配置外部搜索能力，已保留初稿结果。"],
        });
        diagnostics.path = "initial_draft_only";
        return finalizeResult({
          parsed: structured,
          parseSource,
          verificationStatus: structured.verification.status,
          verificationMethod: structured.verification.method,
          verificationReason: structured.verification.reason,
          verificationWarnings: structured.verification.warnings,
          rawLlmOutput: rawLlmOutput || undefined,
          diagnostics,
        }, {
          flowContext: dependencies?.flowContext,
          execution,
          input,
          retrievalConfidence: retrieval.retrievalConfidence,
          evidenceLines: retrievalContext.evidenceLines,
          sourceCount: verificationPages.length,
        });
      }
      throw error instanceof Error ? error : new Error(String(error ?? initialError ?? "VERIFY_FAILED"));
    }
  } catch (error) {
    parseSource = "fallback";
    diagnostics.path = "fallback";
    pushDegradedStage(diagnostics, "fallback_used");
    console.error("[reagent-parse] llm parse failed", {
      model,
      baseURL: activeBaseUrl,
      errorName: error instanceof Error ? error.name : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
      retrievalMatches: retrieval.matchedEntries.length,
      retrievalCandidates: {
        categories: retrieval.candidateCategories,
        subCategories: retrieval.candidateSubCategories,
        experimentTags: retrieval.candidateExperimentTags,
      },
      retrievalEvidencePreview: previewText(retrieval.evidenceLines.join(" | ")),
      rawOutputLength: rawLlmOutput.length,
      rawOutputPreview: previewText(rawLlmOutput),
    });
    structured = withVerification(
      heuristicFallback({
        name: input.name,
        catalogNo: input.catalogNo,
        note: input.note,
      }),
      {
        status: "unverified",
        method: "none",
        reason: "fallback_used",
        warnings: ["模型解析与联网纠错均失败，已使用规则兜底。"],
      },
    );
  }

  return finalizeResult({
    parsed: structured,
    parseSource,
    verificationStatus: structured.verification.status,
    verificationMethod: structured.verification.method,
    verificationReason: structured.verification.reason,
    verificationWarnings: structured.verification.warnings,
    rawLlmOutput: rawLlmOutput || undefined,
    diagnostics,
  }, {
    flowContext: dependencies?.flowContext,
    execution,
    input,
    retrievalConfidence: retrieval.retrievalConfidence,
    evidenceLines: retrievalContext.evidenceLines,
    sourceCount: 0,
  });
}
