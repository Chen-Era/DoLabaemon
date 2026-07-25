import { experimentTags } from "@/lib/rules/catalog";
import { antibodyRoleValues, reagentCategoryValues } from "@/lib/reagent-ingest/types";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeEmptyValues(value: unknown): unknown {
  if (typeof value === "string") {
    return value.trim() === "" ? null : value;
  }

  if (Array.isArray(value)) {
    return value.map(normalizeEmptyValues).filter((item) => item !== null);
  }

  if (isPlainObject(value)) {
    const normalizedEntries = Object.entries(value).map(([key, item]) => [key, normalizeEmptyValues(item)] as const);
    const normalizedObject = Object.fromEntries(normalizedEntries);
    const hasMeaningfulValue = Object.values(normalizedObject).some((item) => item !== null);
    return hasMeaningfulValue ? normalizedObject : null;
  }

  return value;
}

export function normalizeLlmParsedPayload<T>(value: T): T {
  return normalizeEmptyValues(value) as T;
}

export type CoercedPayload = {
  payload: Record<string, unknown>;
  warnings: string[];
};

const experimentTagSet = new Set<string>(experimentTags);
const reagentCategorySet = new Set<string>(reagentCategoryValues);
const antibodyRoleSet = new Set<string>(antibodyRoleValues);

// Models frequently answer with near-miss variants (plurals, family names).
const categorySynonyms: Record<string, string> = {
  ANTIBODIES: "ANTIBODY",
  PROTEIN: "BIOLOGICAL",
  PROTEINS: "BIOLOGICAL",
  ENZYME: "BIOLOGICAL",
  ENZYMES: "BIOLOGICAL",
  PLASMID: "BIOLOGICAL",
  PLASMIDS: "BIOLOGICAL",
  VIRUS: "BIOLOGICAL",
  OLIGO: "PRIMER",
  OLIGOS: "PRIMER",
  PRIMERS: "PRIMER",
  CHEMICALS: "CHEMICAL",
  COMPOUND: "CHEMICAL",
  SMALL_MOLECULE: "CHEMICAL",
  KITS: "KIT",
  BUFFERS: "BUFFER",
  MEDIUM: "CHEMICAL",
  CONSUMABLES: "CONSUMABLE",
  PLASTICWARE: "CONSUMABLE",
};

function asCleanString(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function coerceBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 0 ? false : value === 1 ? true : null;
  if (typeof value === "string") {
    const lowered = value.trim().toLowerCase();
    if (["true", "yes", "y", "1", "是"].includes(lowered)) return true;
    if (["false", "no", "n", "0", "否"].includes(lowered)) return false;
  }
  return null;
}

function coerceCategory(value: unknown, warnings: string[]) {
  const raw = asCleanString(value);
  if (!raw) {
    warnings.push(`模型未给出有效 category，已按 OTHER 处理。`);
    return "OTHER";
  }
  const upper = raw.toUpperCase().replace(/[\s-]+/g, "_");
  if (reagentCategorySet.has(upper)) return upper;
  const synonym = categorySynonyms[upper];
  if (synonym) {
    warnings.push(`模型返回的 category "${raw}" 已映射为标准分类 ${synonym}。`);
    return synonym;
  }
  warnings.push(`模型返回了无法识别的 category "${raw}"，已按 OTHER 处理。`);
  return "OTHER";
}

// Accepts 0-1 floats, 0-100 scales, percentages and numeric strings.
function coerceConfidence(value: unknown, warnings: string[]) {
  let num: number;
  if (typeof value === "number") {
    num = value;
  } else if (typeof value === "string") {
    const cleaned = value.trim().replace(/%$/, "");
    num = Number(cleaned);
  } else {
    num = Number.NaN;
  }
  if (!Number.isFinite(num)) {
    warnings.push("模型未给出可解析的 confidence，已按 0.5 处理。");
    return 0.5;
  }
  if (num > 1 && num <= 100) {
    warnings.push(`模型按 0-100 区间返回 confidence=${num}，已归一化到 0-1。`);
    num = num / 100;
  }
  const clamped = Math.min(1, Math.max(0, num));
  return Math.round(clamped * 1000) / 1000;
}

function coerceExperimentTags(value: unknown, warnings: string[]) {
  const items = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[,，;；]/) : [];
  const valid: string[] = [];
  const dropped: string[] = [];
  for (const item of items) {
    const raw = asCleanString(item);
    if (!raw) continue;
    const normalizedTag = raw.toUpperCase().replace(/[\s-]+/g, "_");
    if (experimentTagSet.has(normalizedTag)) {
      if (!valid.includes(normalizedTag)) valid.push(normalizedTag);
    } else {
      dropped.push(raw);
    }
  }
  if (dropped.length) {
    warnings.push(`已忽略不在词表内的实验标签：${dropped.join(", ")}。`);
  }
  return valid;
}

function coerceStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map(asCleanString).filter((item): item is string => Boolean(item));
}

function coerceAntibodyMeta(value: unknown, warnings: string[]) {
  if (!isPlainObject(value)) return null;
  const rawRole = asCleanString(value.role);
  let role: string | null = null;
  if (rawRole) {
    const upper = rawRole.toUpperCase();
    if (antibodyRoleSet.has(upper)) {
      role = upper;
    } else {
      warnings.push(`模型返回的 antibodyMeta.role "${rawRole}" 无法识别，已置空。`);
    }
  }
  const meta = {
    role,
    hostSpecies: asCleanString(value.hostSpecies),
    targetSpecies: asCleanString(value.targetSpecies),
    targetName: asCleanString(value.targetName),
  };
  return Object.values(meta).some((item) => item !== null) ? meta : null;
}

function coercePrimerMeta(value: unknown) {
  if (!isPlainObject(value)) return null;
  const meta = {
    targetName: asCleanString(value.targetName),
    isReferenceGene: coerceBoolean(value.isReferenceGene),
  };
  return Object.values(meta).some((item) => item !== null) ? meta : null;
}

/**
 * Best-effort coercion of raw model JSON into the reagentParsedSchema shape.
 * Real-world models often answer with 0-100 confidence, lowercase enums or
 * invented tags; rejecting the whole draft on those near-misses used to push
 * the pipeline into the heuristic fallback. Coercion keeps the draft usable
 * and records every repair as a warning instead.
 */
export function coerceReagentParsedPayload(raw: unknown): CoercedPayload {
  const warnings: string[] = [];
  // Some models wrap the object in a single-element array.
  const source = Array.isArray(raw) && raw.length === 1 ? raw[0] : raw;
  const input = isPlainObject(source) ? source : {};
  if (!isPlainObject(source)) {
    warnings.push("模型输出不是 JSON 对象，已按空草稿处理。");
  }

  return {
    payload: {
      category: coerceCategory(input.category, warnings),
      subCategory: asCleanString(input.subCategory),
      vendor: asCleanString(input.vendor),
      confidence: coerceConfidence(input.confidence, warnings),
      warnings: coerceStringArray(input.warnings),
      experimentTags: coerceExperimentTags(input.experimentTags, warnings),
      antibodyMeta: coerceAntibodyMeta(input.antibodyMeta, warnings),
      primerMeta: coercePrimerMeta(input.primerMeta),
    },
    warnings,
  };
}

const verificationStatuses = new Set(["verified", "unverified"]);
const verificationMethods = new Set(["native_web_search", "external_search", "none"]);
const verificationReasons = new Set([
  "verified",
  "native_tool_unavailable",
  "native_search_no_sources",
  "external_search_unconfigured",
  "external_search_failed",
  "external_search_no_results",
  "verification_model_failed",
  "fallback_used",
]);

export function coerceVerifiedReagentPayload(raw: unknown): CoercedPayload {
  const base = coerceReagentParsedPayload(raw);
  const source = Array.isArray(raw) && raw.length === 1 ? raw[0] : raw;
  const verification = isPlainObject(source) && isPlainObject(source.verification) ? source.verification : {};
  const warnings = [...base.warnings];

  const rawStatus = asCleanString(verification.status)?.toLowerCase() ?? "";
  const status = verificationStatuses.has(rawStatus) ? rawStatus : "unverified";
  const rawMethod = asCleanString(verification.method)?.toLowerCase() ?? "";
  const method = verificationMethods.has(rawMethod) ? rawMethod : "none";
  const rawReason = asCleanString(verification.reason)?.toLowerCase() ?? "";
  const reason = verificationReasons.has(rawReason) ? rawReason : status === "verified" ? "verified" : "verification_model_failed";

  return {
    payload: {
      ...base.payload,
      verification: {
        status,
        method,
        reason,
        warnings: coerceStringArray(verification.warnings),
      },
    },
    warnings,
  };
}

/**
 * Row-level salvage for batch extraction: keep every row with a usable name,
 * coerce field types, and drop only items that are not reagent rows at all.
 */
export function coerceReagentBatchExtractRows(raw: unknown): Record<string, unknown>[] {
  const items = Array.isArray(raw) ? raw : isPlainObject(raw) ? [raw] : [];
  const rows: Record<string, unknown>[] = [];
  for (const item of items) {
    if (!isPlainObject(item)) continue;
    const name = asCleanString(item.name);
    if (!name) continue;
    rows.push({
      sourceText: asCleanString(item.sourceText) ?? name,
      name,
      vendor: asCleanString(item.vendor),
      catalogNo: asCleanString(item.catalogNo),
      note: asCleanString(item.note),
      antibodyCompatibilityText: asCleanString(item.antibodyCompatibilityText),
    });
  }
  return rows;
}
