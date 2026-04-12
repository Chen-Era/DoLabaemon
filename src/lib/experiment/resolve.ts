import { getLlmClient } from "@/lib/llm/client";
import { normalizeLlmParsedPayload } from "@/lib/llm/normalize";
import { buildExperimentResolvePrompt } from "@/lib/llm/prompts/experiment-resolve";
import { experimentResolveSchema } from "@/lib/llm/schemas";
import { retrieveExperimentKnowledge } from "@/lib/experiment-knowledge/retrieval";
import type { ExperimentResolution, ExperimentResolutionSuggestion } from "@/lib/experiment-knowledge/types";
import { experimentTypeCatalog } from "@/lib/rules/catalog";

type ResolveInput = {
  customExperimentName: string;
  experimentContext?: string | null;
  directionCode?: string | null;
  lang?: "zh" | "en";
};

type LooseSuggestionShape = {
  proposedExperimentName?: unknown;
  proposedExperimentCode?: unknown;
  matchedExistingCode?: unknown;
  workflowStages?: unknown;
  minRequiredItems?: unknown;
  recommendedItems?: unknown;
  warnings?: unknown;
  rationale?: unknown;
  confidence?: unknown;
};

function normalizeText(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, " ").replace(/\s+/g, " ").trim();
}

function makeCodeFromName(name: string) {
  const letters = name.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return letters.slice(0, 30) || "CUSTOM_EXPERIMENT";
}

function findDirectCatalogMatch(customExperimentName: string) {
  const normalizedInput = normalizeText(customExperimentName);

  for (const item of experimentTypeCatalog) {
    if (normalizeText(item.code) === normalizedInput) {
      return { item, source: "DIRECT" as const, confidence: 0.99 };
    }
    if ([item.nameZh, item.nameEn].some((value) => normalizeText(value) === normalizedInput)) {
      return { item, source: "ALIAS_MATCH" as const, confidence: 0.95 };
    }
    if (item.aliases.some((alias) => normalizeText(alias) === normalizedInput)) {
      return { item, source: "ALIAS_MATCH" as const, confidence: 0.93 };
    }
  }

  return null;
}

function fallbackSuggestion(input: ResolveInput, retrieval: ReturnType<typeof retrieveExperimentKnowledge>): ExperimentResolutionSuggestion {
  const bestMatch = retrieval.matchedEntries[0]?.entry;
  return {
    proposedExperimentName: bestMatch?.canonicalName ?? input.customExperimentName.trim(),
    proposedExperimentCode: bestMatch?.normalizedCode ?? makeCodeFromName(input.customExperimentName),
    matchedExistingCode: bestMatch?.normalizedCode ?? null,
    workflowStages: bestMatch?.workflowStages.map((stage) => stage.labelZh) ?? ["样本准备", "核心反应", "检测读出"],
    minRequiredItems:
      bestMatch?.requiredReagentTemplates.map((item) => ({
        name: item.nameZh,
        matcherType: item.matcherType,
        matcherValues: item.matcherValues,
      })) ?? [],
    recommendedItems:
      bestMatch?.recommendedReagentTemplates.map((item) => ({
        name: item.nameZh,
        matcherType: item.matcherType,
        matcherValues: item.matcherValues,
      })) ?? [],
    warnings: bestMatch
      ? ["当前为低匹配度候选，建议人工确认后再作为正式实验类型使用。"]
      : ["当前未找到高置信匹配，建议结合实验流程补充上下文并人工确认。"],
    rationale: bestMatch
      ? `根据项目实验知识资产，最接近的候选为 ${bestMatch.canonicalName}。`
      : "未命中高置信已有实验类型，已返回保守候选结构。",
    confidence: retrieval.retrievalConfidence ? Math.min(retrieval.retrievalConfidence, 0.72) : 0.35,
  };
}

function normalizeSuggestedItems(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (typeof item === "string") {
      return { name: item, matcherType: "NAME_ANY", matcherValues: [item] };
    }
    if (typeof item === "object" && item !== null) {
      const candidate = item as Record<string, unknown>;
      return {
        name: typeof candidate.name === "string" ? candidate.name : "未命名试剂项",
        matcherType: typeof candidate.matcherType === "string" ? candidate.matcherType : "NAME_ANY",
        matcherValues: Array.isArray(candidate.matcherValues)
          ? candidate.matcherValues.filter((x): x is string => typeof x === "string")
          : [],
      };
    }
    return { name: "未命名试剂项", matcherType: "NAME_ANY", matcherValues: [] };
  });
}

function normalizeLooseSuggestion(value: LooseSuggestionShape): LooseSuggestionShape {
  return {
    proposedExperimentName: typeof value.proposedExperimentName === "string" ? value.proposedExperimentName : "候选实验类型",
    proposedExperimentCode: typeof value.proposedExperimentCode === "string" ? value.proposedExperimentCode : null,
    matchedExistingCode: typeof value.matchedExistingCode === "string" ? value.matchedExistingCode : null,
    workflowStages: Array.isArray(value.workflowStages)
      ? value.workflowStages.filter((x): x is string => typeof x === "string")
      : [],
    minRequiredItems: normalizeSuggestedItems(value.minRequiredItems),
    recommendedItems: normalizeSuggestedItems(value.recommendedItems),
    warnings: Array.isArray(value.warnings) ? value.warnings.filter((x): x is string => typeof x === "string") : [],
    rationale: typeof value.rationale === "string" ? value.rationale : null,
    confidence: typeof value.confidence === "number" ? value.confidence : 0.45,
  };
}

export async function resolveExperimentInput(input: ResolveInput): Promise<ExperimentResolution> {
  const directMatch = findDirectCatalogMatch(input.customExperimentName);
  if (directMatch) {
    return {
      resolvedExperimentType: directMatch.item.code,
      resolutionSource: directMatch.source,
      resolutionConfidence: directMatch.confidence,
      needsConfirmation: false,
      warnings: [],
      suggestion: null,
    };
  }

  const retrieval = retrieveExperimentKnowledge({
    customExperimentName: input.customExperimentName,
    experimentContext: input.experimentContext,
    directionCode: input.directionCode,
  });

  const bestMatch = retrieval.matchedEntries[0]?.entry;
  if (bestMatch && retrieval.retrievalConfidence >= 0.82) {
    return {
      resolvedExperimentType: bestMatch.normalizedCode,
      resolutionSource: "ALIAS_MATCH",
      resolutionConfidence: retrieval.retrievalConfidence,
      needsConfirmation: false,
      warnings: [],
      suggestion: null,
    };
  }

  let suggestion = fallbackSuggestion(input, retrieval);
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      const client = getLlmClient();
      const model = process.env.OPENAI_MODEL || "MiniMax-M1-80k";
      const response = await client.responses.create({
        model,
        input: [
          {
            role: "system",
            content: buildExperimentResolvePrompt(input.lang ?? "zh", {
              candidateCodes: retrieval.candidateCodes,
              workflowHints: retrieval.workflowHints,
              requiredTemplateHints: retrieval.requiredTemplateHints,
              recommendedTemplateHints: retrieval.recommendedTemplateHints,
              evidenceLines: retrieval.evidenceLines,
            }),
          },
          {
            role: "user",
            content: JSON.stringify({
              customExperimentName: input.customExperimentName,
              experimentContext: input.experimentContext,
              directionCode: input.directionCode,
            }),
          },
        ],
        temperature: 0,
      });
      const rawOutput = response.output_text || "{}";
      suggestion = experimentResolveSchema.parse(normalizeLlmParsedPayload(normalizeLooseSuggestion(JSON.parse(rawOutput))));
    }
  } catch (error) {
    console.error("[experiment-resolve] llm suggestion failed", {
      errorName: error instanceof Error ? error.name : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
      retrievalConfidence: retrieval.retrievalConfidence,
      candidateCodes: retrieval.candidateCodes,
    });
  }

  return {
    resolvedExperimentType: suggestion.matchedExistingCode ?? null,
    resolutionSource: "MODEL_SUGGESTION",
    resolutionConfidence: suggestion.confidence,
    needsConfirmation: true,
    warnings: suggestion.warnings,
    suggestion,
  };
}
