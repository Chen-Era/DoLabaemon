import { generateLlmText, getLlmClient } from "@/lib/llm/client";
import { parseLlmJson } from "@/lib/llm/json-output";
import { normalizeLlmParsedPayload } from "@/lib/llm/normalize";
import { techniqueAiMatchSchema } from "@/lib/llm/schemas";
import { buildTechniqueAiMatchPrompt } from "@/lib/llm/prompts/technique-ai-match";
import type { RuntimeLlmConfig } from "@/lib/llm/runtime-config";
import type { ExperimentTechnique } from "@/lib/experiment-techniques/types";
import { cleanUrlText } from "@/lib/url/clean-url";
import { withTimeout } from "@/lib/async/with-timeout";

export const LLM_NOT_CONFIGURED_ERROR = "LLM_NOT_CONFIGURED";

// Reasoning models can take well over a minute on slow providers; keep the
// request bounded so the route returns a clear degradation instead of hanging.
const AI_MATCH_TIMEOUT_MS = 90000;
const MAX_CATALOG_SCOPE_CHARS = 60;

export type TechniqueAiMatch = {
  code: string;
  confidence: number;
  rationale: string;
  technique: ExperimentTechnique;
};

export type TechniqueAiMatchResult = {
  candidates: TechniqueAiMatch[];
  notes: string | null;
};

function summarizeScope(text: string) {
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length > MAX_CATALOG_SCOPE_CHARS
    ? `${compact.slice(0, MAX_CATALOG_SCOPE_CHARS)}…`
    : compact;
}

/**
 * Compact, token-friendly catalog lines so the model sees every selectable
 * technique: CODE | zh name | en name | aliases | category | scope summary.
 */
export function buildTechniqueCatalogDigest(techniques: ExperimentTechnique[]) {
  return techniques
    .map((technique) =>
      [
        technique.code,
        technique.name.zh,
        technique.name.en,
        technique.aliases.join("/"),
        technique.categoryCode,
        summarizeScope(technique.scope.zh || technique.scope.en),
      ].join(" | "),
    )
    .join("\n");
}

function clampConfidence(value: unknown) {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return 0.5;
  // Tolerate 0-100 scales from chatty models.
  const scaled = num > 1 && num <= 100 ? num / 100 : num;
  return Math.round(Math.min(1, Math.max(0, scaled)) * 1000) / 1000;
}

type LooseMatchShape = {
  matches?: unknown;
  notes?: unknown;
};

function normalizeLooseMatchPayload(value: LooseMatchShape): LooseMatchShape {
  const rawMatches = Array.isArray(value.matches) ? value.matches : [];
  return {
    matches: rawMatches
      .map((item) => {
        if (typeof item === "string") {
          return { code: item, confidence: 0.5, rationale: "" };
        }
        if (typeof item === "object" && item !== null) {
          const candidate = item as Record<string, unknown>;
          return {
            code: typeof candidate.code === "string" ? candidate.code : "",
            confidence: clampConfidence(candidate.confidence),
            rationale: typeof candidate.rationale === "string" ? candidate.rationale : "",
          };
        }
        return { code: "", confidence: 0, rationale: "" };
      })
      .filter((item) => item.code.trim().length > 0),
    notes: typeof value.notes === "string" ? value.notes : null,
  };
}

/**
 * Validate raw model output against the real catalog: parse, drop invented or
 * non-selectable codes, dedupe, sort by confidence and cap at `limit`.
 * Exported for tests.
 */
export function normalizeAiMatchResponse(
  rawPayload: unknown,
  techniques: ExperimentTechnique[],
  limit: number,
): TechniqueAiMatchResult {
  const selectable = new Map(
    techniques
      .filter((technique) => technique.status === "PUBLISHED" && !technique.isAbstract)
      .map((technique) => [technique.code, technique]),
  );

  const normalized = normalizeLlmParsedPayload(
    normalizeLooseMatchPayload((rawPayload ?? {}) as LooseMatchShape),
  );
  const parsed = techniqueAiMatchSchema.parse(normalized ?? { matches: [] });

  const seen = new Set<string>();
  const candidates: TechniqueAiMatch[] = [];
  for (const match of parsed.matches) {
    if (seen.has(match.code)) continue;
    seen.add(match.code);
    const technique = selectable.get(match.code);
    if (!technique) continue;
    candidates.push({
      code: match.code,
      confidence: clampConfidence(match.confidence),
      rationale: match.rationale,
      technique,
    });
  }

  candidates.sort((left, right) => right.confidence - left.confidence);
  return {
    candidates: candidates.slice(0, limit),
    notes: parsed.notes?.trim() ? parsed.notes.trim() : null,
  };
}

export async function matchTechniquesWithLlm(input: {
  query: string;
  techniques: ExperimentTechnique[];
  llmConfig?: RuntimeLlmConfig;
  limit?: number;
  lang?: "zh" | "en";
}): Promise<TechniqueAiMatchResult> {
  const limit = Math.min(Math.max(input.limit ?? 5, 1), 20);
  const selectable = input.techniques.filter(
    (technique) => technique.status === "PUBLISHED" && !technique.isAbstract,
  );
  if (!selectable.length) {
    return { candidates: [], notes: null };
  }

  const apiKey = input.llmConfig?.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(LLM_NOT_CONFIGURED_ERROR);
  }

  const client = getLlmClient({ apiKey, baseURL: input.llmConfig?.baseURL });
  const model = input.llmConfig?.model || process.env.OPENAI_MODEL || "MiniMax-M1-80k";
  const result = await withTimeout(
    generateLlmText(
      client,
      { baseURL: cleanUrlText(input.llmConfig?.baseURL) ?? cleanUrlText(process.env.OPENAI_BASE_URL) },
      {
        model,
        input: [
          {
            role: "system",
            content: buildTechniqueAiMatchPrompt(
              input.lang ?? "zh",
              buildTechniqueCatalogDigest(selectable),
            ),
          },
          {
            role: "user",
            content: JSON.stringify({ query: input.query }),
          },
        ],
        temperature: 0,
      },
    ),
    AI_MATCH_TIMEOUT_MS,
    "TECHNIQUE_AI_MATCH",
  );

  return normalizeAiMatchResponse(parseLlmJson(result.text || "{}"), input.techniques, limit);
}
