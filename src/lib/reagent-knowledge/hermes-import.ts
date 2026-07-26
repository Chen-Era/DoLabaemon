import { z } from "zod";

import { reagentCategoryValues } from "@/lib/reagent-ingest/types";
import { experimentTags } from "@/lib/rules/catalog";
import type { ReagentKnowledgeEntry } from "@/lib/reagent-knowledge/types";

export const hermesKnowledgeEvidenceTypes = ["exact_alias", "pattern", "keyword_family"] as const;

export const HERMES_ENTRY_ID_PREFIX = "hermes-";

/**
 * Hermes 知识管家产出的单行 JSONL 契约。
 * 枚举取值与项目源码保持一致：
 * - category:        src/lib/reagent-ingest/types.ts 的 reagentCategoryValues
 * - experimentTags:  src/lib/rules/catalog.ts 的 experimentTags
 * - evidenceType:    src/lib/reagent-knowledge/types.ts 的 ReagentKnowledgeEvidenceType
 */
export const hermesKnowledgeLineSchema = z.object({
  id: z.string().min(1),
  canonicalName: z.string().min(1),
  aliases: z.array(z.string().min(1)).min(1),
  category: z.enum(reagentCategoryValues),
  subCategory: z.string().nullable().optional(),
  experimentTags: z.array(z.enum(experimentTags)).default([]),
  namePatterns: z.array(z.string()).default([]),
  requiredKeywords: z.array(z.string()).default([]),
  excludedKeywords: z.array(z.string()).default([]),
  vendorHints: z.array(z.string()).default([]),
  evidenceType: z.enum(hermesKnowledgeEvidenceTypes),
  confidenceHint: z.number().min(0).max(1),
  notes: z.string().optional(),
});

export type HermesKnowledgeLine = z.infer<typeof hermesKnowledgeLineSchema>;

export type ParseHermesKnowledgeResult =
  | { ok: true; entry: ReagentKnowledgeEntry }
  | { ok: false; error: string };

export type HermesKnowledgeImportResult = {
  imported: ReagentKnowledgeEntry[];
  rejected: { line: number; error: string }[];
};

/**
 * 强制 hermes- 前缀：已带前缀的 id 保留（主体仍做 slug 规范化），
 * 没有的规范化后补上。规范化后不含任何字母数字时返回 null（交由调用方判失败）。
 */
export function normalizeHermesEntryId(rawId: string): string | null {
  const lowered = rawId.trim().toLowerCase();
  const body = lowered.startsWith(HERMES_ENTRY_ID_PREFIX)
    ? lowered.slice(HERMES_ENTRY_ID_PREFIX.length)
    : lowered;
  const slug = body.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (!slug) return null;
  return `${HERMES_ENTRY_ID_PREFIX}${slug}`;
}

function formatZodIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.join(".") || "(root)";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}

/** 逐条试编译 namePatterns，非法正则判失败（运行时的 new RegExp 不会因坏模式炸掉检索）。 */
function findInvalidPattern(patterns: string[]): string | null {
  for (const pattern of patterns) {
    try {
      new RegExp(pattern);
    } catch (error) {
      return `"${pattern}": ${error instanceof Error ? error.message : String(error)}`;
    }
  }
  return null;
}

export function parseHermesKnowledgeLine(line: string): ParseHermesKnowledgeResult {
  const trimmed = line.trim();
  if (!trimmed) {
    return { ok: false, error: "空行" };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(trimmed);
  } catch (error) {
    return { ok: false, error: `JSON 解析失败: ${error instanceof Error ? error.message : String(error)}` };
  }

  const parsed = hermesKnowledgeLineSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: `字段校验失败: ${formatZodIssues(parsed.error)}` };
  }

  const invalidPattern = findInvalidPattern(parsed.data.namePatterns);
  if (invalidPattern) {
    return { ok: false, error: `namePatterns 含非法正则 ${invalidPattern}` };
  }

  const id = normalizeHermesEntryId(parsed.data.id);
  if (!id) {
    return { ok: false, error: `id "${parsed.data.id}" 规范化后为空，无法生成 ${HERMES_ENTRY_ID_PREFIX} 前缀标识` };
  }

  const data = parsed.data;
  const entry: ReagentKnowledgeEntry = {
    id,
    canonicalName: data.canonicalName,
    aliases: data.aliases,
    category: data.category,
    subCategory: data.subCategory ?? null,
    experimentTags: data.experimentTags,
    namePatterns: data.namePatterns,
    requiredKeywords: data.requiredKeywords,
    excludedKeywords: data.excludedKeywords,
    vendorHints: data.vendorHints,
    evidenceType: data.evidenceType,
    confidenceHint: data.confidenceHint,
    ...(data.notes !== undefined ? { notes: data.notes } : {}),
  };
  return { ok: true, entry };
}

/** 逐行解析 JSONL：空行（含文件末尾换行）跳过，坏行记录 1-based 行号继续。 */
export function importHermesKnowledge(jsonl: string): HermesKnowledgeImportResult {
  const imported: ReagentKnowledgeEntry[] = [];
  const rejected: { line: number; error: string }[] = [];

  jsonl.split(/\r?\n/).forEach((line, index) => {
    if (!line.trim()) return;
    const result = parseHermesKnowledgeLine(line);
    if (result.ok) {
      imported.push(result.entry);
    } else {
      rejected.push({ line: index + 1, error: result.error });
    }
  });

  return { imported, rejected };
}
