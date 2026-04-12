import { z } from "zod";
import { getLlmClient } from "@/lib/llm/client";
import { normalizeLlmParsedPayload } from "@/lib/llm/normalize";
import { buildReagentParsePrompt } from "@/lib/llm/prompts/reagent-parse";
import { buildReagentVerifyPrompt } from "@/lib/llm/prompts/reagent-verify";
import { getNativeWebSearchToolType } from "@/lib/llm/model-capabilities";
import { reagentParsedSchema, verifiedReagentParsedSchema } from "@/lib/llm/schemas";
import { retrieveReagentKnowledge } from "@/lib/reagent-knowledge/retrieval";
import { buildHeuristicParse } from "@/lib/reagent-tagging";
import { fetchVerificationPages, type VerificationPage } from "@/lib/reagent-ingest/fetch-verification-pages";
import { isExternalSearchConfigured, searchReagentWeb } from "@/lib/reagent-ingest/web-search";

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
  verificationMethod: "native_web_search" | "external_search" | "none";
  verificationReason: z.infer<typeof verifiedReagentParsedSchema>["verification"]["reason"];
  verificationWarnings: string[];
  rawLlmOutput?: string;
};

type ParseReagentDependencies = {
  client?: ReturnType<typeof getLlmClient>;
  searchWeb?: typeof searchReagentWeb;
  fetchPages?: typeof fetchVerificationPages;
};

function previewText(text: string, limit = 600) {
  return text.length <= limit ? text : `${text.slice(0, limit)}...(truncated)`;
}

function heuristicFallback(input: { name: string; catalogNo?: string; note?: string | null }) {
  return buildHeuristicParse(input) as z.infer<typeof reagentParsedSchema>;
}

function parseJsonText(rawText: string) {
  return JSON.parse(rawText);
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

function extractNativeSearchSources(response: unknown) {
  const output = (response as { output?: Array<{ type?: string; action?: { sources?: Array<{ url?: string }> } }> })?.output ?? [];
  return output.flatMap((item) => (item.type === "web_search_call" ? item.action?.sources ?? [] : [])).filter((item) => item?.url);
}

function buildVerificationPayload(
  parsed: z.infer<typeof reagentParsedSchema>,
  payload: z.infer<typeof verifiedReagentParsedSchema>["verification"],
) {
  return withVerification(parsed, payload);
}

async function generateInitialDraft(
  client: ReturnType<typeof getLlmClient>,
  model: string,
  input: ParseReagentInput,
  retrieval: ReturnType<typeof retrieveReagentKnowledge>,
) {
  const response = await client.responses.create({
    model,
    input: [
      {
        role: "system",
        content: buildReagentParsePrompt(input.lang, {
          candidateCategories: retrieval.candidateCategories,
          candidateSubCategories: retrieval.candidateSubCategories,
          candidateExperimentTags: retrieval.candidateExperimentTags,
          evidenceLines: retrieval.evidenceLines,
        }),
      },
      { role: "user", content: JSON.stringify(input) },
    ],
    temperature: 0,
  });

  const rawOutput = response.output_text || "";
  const parsed = reagentParsedSchema.parse(normalizeLlmParsedPayload(parseJsonText(rawOutput)));
  return { rawOutput, parsed };
}

async function verifyWithNativeWebSearch(
  client: ReturnType<typeof getLlmClient>,
  model: string,
  input: ParseReagentInput,
  initialDraft: z.infer<typeof reagentParsedSchema> | null,
  retrieval: ReturnType<typeof retrieveReagentKnowledge>,
) {
  const toolType = getNativeWebSearchToolType({ baseUrl: process.env.OPENAI_BASE_URL, model });
  if (!toolType) return null;

  const response = await client.responses.create({
    model,
    tools: [{ type: toolType, search_context_size: "medium" }],
    include: ["web_search_call.action.sources"],
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
  });

  const rawOutput = response.output_text || "";
  const parsed = verifiedReagentParsedSchema.parse(normalizeLlmParsedPayload(parseJsonText(rawOutput)));
  const sources = extractNativeSearchSources(response);
  return { rawOutput, parsed, sourceCount: sources.length };
}

async function verifyWithExternalEvidence(
  client: ReturnType<typeof getLlmClient>,
  model: string,
  input: ParseReagentInput,
  initialDraft: z.infer<typeof reagentParsedSchema> | null,
  retrieval: ReturnType<typeof retrieveReagentKnowledge>,
  externalEvidence: VerificationPage[],
) {
  const verificationMethod = externalEvidence.length ? "external_search" : "none";
  const response = await client.responses.create({
    model,
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
  });

  const rawOutput = response.output_text || "";
  const parsed = verifiedReagentParsedSchema.parse(normalizeLlmParsedPayload(parseJsonText(rawOutput)));
  return { rawOutput, parsed };
}

export async function parseReagentInput(
  input: ParseReagentInput,
  dependencies?: ParseReagentDependencies,
): Promise<ParseReagentResult> {
  let structured: z.infer<typeof verifiedReagentParsedSchema>;
  let parseSource: "llm" | "fallback" = "llm";
  let rawLlmOutput = "";
  const model = process.env.OPENAI_MODEL || "MiniMax-M1-80k";
  const retrieval = retrieveReagentKnowledge({
    name: input.name,
    catalogNo: input.catalogNo,
    note: input.note ?? undefined,
  });
  const searchWeb = dependencies?.searchWeb ?? searchReagentWeb;
  const fetchPages = dependencies?.fetchPages ?? fetchVerificationPages;

  try {
    const client = dependencies?.client ?? getLlmClient();
    let initialDraft: z.infer<typeof reagentParsedSchema> | null = null;
    let initialError: unknown = null;

    try {
      const initial = await generateInitialDraft(client, model, input, retrieval);
      rawLlmOutput = initial.rawOutput;
      initialDraft = initial.parsed;
    } catch (error) {
      initialError = error;
      console.error("[reagent-parse] initial draft failed", {
        model,
        errorName: error instanceof Error ? error.name : typeof error,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }

    try {
      const nativeVerified = await verifyWithNativeWebSearch(client, model, input, initialDraft, retrieval);
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
        return {
          parsed: structured,
          parseSource,
          verificationStatus: structured.verification.status,
          verificationMethod: structured.verification.method,
          verificationReason: structured.verification.reason,
          verificationWarnings: structured.verification.warnings,
          rawLlmOutput: rawLlmOutput || undefined,
        };
      }
    } catch (error) {
      console.error("[reagent-parse] native verification failed", {
        model,
        errorName: error instanceof Error ? error.name : typeof error,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }

    let verificationPages: VerificationPage[] = [];
    let verificationReason: ParseReagentResult["verificationReason"] = "native_tool_unavailable";
    let externalSearchFailed = false;
    const externalSearchConfigured = dependencies?.searchWeb ? true : isExternalSearchConfigured();
    try {
      if (!externalSearchConfigured) {
        verificationReason = "external_search_unconfigured";
      } else {
        const searchResults = await searchWeb(buildVerificationQuery(input));
        if (searchResults.length) {
          verificationPages = await fetchPages(searchResults);
          verificationReason = verificationPages.length ? "verified" : "external_search_no_results";
        } else {
          verificationReason = "external_search_no_results";
        }
      }
    } catch (error) {
      externalSearchFailed = true;
      verificationReason = "external_search_failed";
      console.error("[reagent-parse] external search failed", {
        errorName: error instanceof Error ? error.name : typeof error,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }

    try {
      const externallyVerified = await verifyWithExternalEvidence(client, model, input, initialDraft, retrieval, verificationPages);
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
      return {
        parsed: structured,
        parseSource,
        verificationStatus: structured.verification.status,
        verificationMethod: structured.verification.method,
        verificationReason: structured.verification.reason,
        verificationWarnings: structured.verification.warnings,
        rawLlmOutput: rawLlmOutput || undefined,
      };
    } catch (error) {
      if (initialDraft) {
        structured = buildVerificationPayload(initialDraft, {
          status: "unverified",
          method: "none",
          reason: externalSearchConfigured ? "verification_model_failed" : "external_search_unconfigured",
          warnings: [externalSearchConfigured ? "联网纠错失败，已保留初稿结果。" : "未配置外部搜索能力，已保留初稿结果。"],
        });
        return {
          parsed: structured,
          parseSource,
          verificationStatus: structured.verification.status,
          verificationMethod: structured.verification.method,
          verificationReason: structured.verification.reason,
          verificationWarnings: structured.verification.warnings,
          rawLlmOutput: rawLlmOutput || undefined,
        };
      }
      throw error instanceof Error ? error : new Error(String(error ?? initialError ?? "VERIFY_FAILED"));
    }
  } catch (error) {
    parseSource = "fallback";
    console.error("[reagent-parse] llm parse failed", {
      model,
      baseURL: process.env.OPENAI_BASE_URL || null,
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

  return {
    parsed: structured,
    parseSource,
    verificationStatus: structured.verification.status,
    verificationMethod: structured.verification.method,
    verificationReason: structured.verification.reason,
    verificationWarnings: structured.verification.warnings,
    rawLlmOutput: rawLlmOutput || undefined,
  };
}
