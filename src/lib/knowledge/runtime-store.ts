import type { ExperimentKnowledgeEntry, ExperimentKnowledgeTemplate, ExperimentWorkflowStage } from "@/lib/experiment-knowledge/types";
import type { ReagentKnowledgeEntry } from "@/lib/reagent-knowledge/types";
import { isDemoMode } from "@/lib/demo-mode";
import {
  demoDeleteExperimentKnowledgeEntry,
  demoDeleteReagentKnowledgeEntry,
  demoListExperimentKnowledgeEntries,
  demoListReagentKnowledgeEntries,
  demoUpsertExperimentKnowledgeEntry,
  demoUpsertReagentKnowledgeEntry,
} from "@/lib/demo-store";
import { prisma } from "@/lib/prisma";
import type { HeuristicParsedReagent } from "@/lib/reagent-tagging";

function makeStableId(prefix: string, raw: string) {
  const normalized = raw
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${prefix}-${normalized || "entry"}`;
}

function escapeRegexLiteral(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function listRuntimeReagentKnowledgeEntries(): Promise<ReagentKnowledgeEntry[]> {
  if (isDemoMode()) {
    return demoListReagentKnowledgeEntries();
  }
  try {
    return (await prisma.reagentKnowledgeEntry.findMany()).map((item) => ({
      ...item,
      experimentTags: item.experimentTags as ReagentKnowledgeEntry["experimentTags"],
      evidenceType: item.evidenceType as ReagentKnowledgeEntry["evidenceType"],
      notes: item.notes ?? undefined,
    }));
  } catch {
    return [];
  }
}

export async function listRuntimeExperimentKnowledgeEntries(): Promise<ExperimentKnowledgeEntry[]> {
  if (isDemoMode()) {
    return demoListExperimentKnowledgeEntries();
  }
  try {
    return (await prisma.experimentKnowledgeEntry.findMany()).map((item) => ({
      ...item,
      workflowStages: item.workflowStages as ExperimentWorkflowStage[],
      requiredReagentTemplates: item.requiredReagentTemplates as ExperimentKnowledgeTemplate[],
      recommendedReagentTemplates: item.recommendedReagentTemplates as ExperimentKnowledgeTemplate[],
      relatedExperimentTags: item.relatedExperimentTags as ExperimentKnowledgeEntry["relatedExperimentTags"],
      source: item.source as ExperimentKnowledgeEntry["source"],
    }));
  } catch {
    return [];
  }
}

export async function getRuntimeReagentKnowledgeEntry(id: string): Promise<ReagentKnowledgeEntry | null> {
  return (await listRuntimeReagentKnowledgeEntries()).find((item) => item.id === id) ?? null;
}

export async function getRuntimeExperimentKnowledgeEntry(id: string): Promise<ExperimentKnowledgeEntry | null> {
  return (await listRuntimeExperimentKnowledgeEntries()).find((item) => item.id === id) ?? null;
}

export async function upsertRuntimeReagentKnowledgeEntry(entry: ReagentKnowledgeEntry) {
  if (isDemoMode()) {
    return demoUpsertReagentKnowledgeEntry(entry);
  }
  return prisma.reagentKnowledgeEntry.upsert({
    where: { id: entry.id },
    create: entry,
    update: {
      canonicalName: entry.canonicalName,
      aliases: entry.aliases,
      category: entry.category,
      subCategory: entry.subCategory,
      experimentTags: entry.experimentTags,
      namePatterns: entry.namePatterns,
      requiredKeywords: entry.requiredKeywords,
      excludedKeywords: entry.excludedKeywords,
      vendorHints: entry.vendorHints,
      evidenceType: entry.evidenceType,
      confidenceHint: entry.confidenceHint,
      notes: entry.notes,
      source: "LEARNED",
    },
  });
}

export async function upsertRuntimeExperimentKnowledgeEntry(entry: ExperimentKnowledgeEntry) {
  if (isDemoMode()) {
    return demoUpsertExperimentKnowledgeEntry(entry);
  }
  return prisma.experimentKnowledgeEntry.upsert({
    where: { id: entry.id },
    create: {
      ...entry,
      workflowStages: entry.workflowStages,
      requiredReagentTemplates: entry.requiredReagentTemplates,
      recommendedReagentTemplates: entry.recommendedReagentTemplates,
    },
    update: {
      canonicalName: entry.canonicalName,
      aliases: entry.aliases,
      normalizedCode: entry.normalizedCode,
      descriptionZh: entry.descriptionZh,
      descriptionEn: entry.descriptionEn,
      supportedDirections: entry.supportedDirections,
      workflowStages: entry.workflowStages,
      requiredReagentTemplates: entry.requiredReagentTemplates,
      recommendedReagentTemplates: entry.recommendedReagentTemplates,
      evidenceKeywords: entry.evidenceKeywords,
      excludedKeywords: entry.excludedKeywords,
      relatedExperimentTags: entry.relatedExperimentTags,
      source: entry.source ?? "LEARNED",
    },
  });
}

export async function deleteRuntimeReagentKnowledgeEntry(id: string) {
  if (isDemoMode()) {
    demoDeleteReagentKnowledgeEntry(id);
    return;
  }
  await prisma.reagentKnowledgeEntry.delete({ where: { id } }).catch(() => undefined);
}

export async function deleteRuntimeExperimentKnowledgeEntry(id: string) {
  if (isDemoMode()) {
    demoDeleteExperimentKnowledgeEntry(id);
    return;
  }
  await prisma.experimentKnowledgeEntry.delete({ where: { id } }).catch(() => undefined);
}

export function buildLearnedReagentKnowledgeEntry(input: {
  entityKey: string;
  parsed: HeuristicParsedReagent | Record<string, unknown>;
}) {
  const rawName = input.entityKey.split("::")[0]?.trim() || input.entityKey;
  const parsed = input.parsed as {
    category?: ReagentKnowledgeEntry["category"];
    subCategory?: string | null;
    experimentTags?: ReagentKnowledgeEntry["experimentTags"];
    vendor?: string | null;
    confidence?: number;
    warnings?: string[];
  };
  const aliases = [...new Set([rawName])];
  return {
    id: makeStableId("reagent", rawName),
    canonicalName: rawName,
    aliases,
    category: parsed.category ?? "OTHER",
    subCategory: parsed.subCategory ?? null,
    experimentTags: parsed.experimentTags ?? [],
    namePatterns: [`\\b${escapeRegexLiteral(rawName.toLowerCase())}\\b`],
    requiredKeywords: [],
    excludedKeywords: [],
    vendorHints: parsed.vendor ? [parsed.vendor] : [],
    evidenceType: "keyword_family" as const,
    confidenceHint: typeof parsed.confidence === "number" ? parsed.confidence : 0.8,
    notes: (parsed.warnings ?? []).join(" | ") || "Learned from reagent parse flow",
    source: "LEARNED",
  } satisfies ReagentKnowledgeEntry & { source: string };
}

export function buildLearnedExperimentKnowledgeEntry(input: {
  entityKey: string;
  suggestion: Record<string, unknown>;
}) {
  const suggestion = input.suggestion as {
    proposedExperimentName?: string;
    proposedExperimentCode?: string | null;
    matchedExistingCode?: string | null;
    workflowStages?: string[];
    minRequiredItems?: Array<{ name?: string; matcherType?: string; matcherValues?: string[] }>;
    recommendedItems?: Array<{ name?: string; matcherType?: string; matcherValues?: string[] }>;
    rationale?: string | null;
  };
  const canonicalName = suggestion.proposedExperimentName?.trim() || input.entityKey;
  const normalizedCode = suggestion.matchedExistingCode?.trim() || suggestion.proposedExperimentCode?.trim() || canonicalName.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
  return {
    id: makeStableId("experiment", normalizedCode),
    canonicalName,
    aliases: [canonicalName],
    normalizedCode,
    descriptionZh: suggestion.rationale?.trim() || `学习得到的实验条目：${canonicalName}`,
    descriptionEn: suggestion.rationale?.trim() || `Learned experiment entry: ${canonicalName}`,
    supportedDirections: [],
    workflowStages: (suggestion.workflowStages ?? []).map((item, index) => ({
      key: `learned-stage-${index + 1}`,
      labelZh: item,
      labelEn: item,
      relatedExperimentTags: [],
    })),
    requiredReagentTemplates: (suggestion.minRequiredItems ?? []).map((item) => ({
      nameZh: item.name ?? "学习试剂项",
      nameEn: item.name ?? "Learned reagent item",
      level: "MIN_REQUIRED" as const,
      matcherType: (item.matcherType as ExperimentKnowledgeTemplate["matcherType"]) ?? "NAME_ANY",
      matcherValues: item.matcherValues ?? [],
    })),
    recommendedReagentTemplates: (suggestion.recommendedItems ?? []).map((item) => ({
      nameZh: item.name ?? "推荐试剂项",
      nameEn: item.name ?? "Recommended reagent item",
      level: "RECOMMENDED" as const,
      matcherType: (item.matcherType as ExperimentKnowledgeTemplate["matcherType"]) ?? "NAME_ANY",
      matcherValues: item.matcherValues ?? [],
    })),
    evidenceKeywords: [canonicalName, normalizedCode],
    excludedKeywords: [],
    relatedExperimentTags: [],
    source: "LEARNED",
  } satisfies ExperimentKnowledgeEntry;
}
