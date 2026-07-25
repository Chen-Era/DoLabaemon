import rawCatalog from "@/lib/reagent-knowledge/catalog.json";
import { listRuntimeReagentKnowledgeEntries } from "@/lib/knowledge/runtime-store";
import { scoreKnowledgeEntry } from "@/lib/reagent-knowledge/scoring";
import type { ReagentKnowledgeCatalog, ReagentKnowledgeMatch, ReagentKnowledgeRetrievalResult } from "@/lib/reagent-knowledge/types";

const staticCatalog = rawCatalog as ReagentKnowledgeCatalog;

function uniq<T>(items: T[]) {
  return [...new Set(items)];
}

export async function retrieveReagentKnowledgeRuntime(input: {
  name: string;
  catalogNo?: string | null;
  note?: string | null;
}): Promise<ReagentKnowledgeRetrievalResult> {
  const searchText = [input.name, input.catalogNo, input.note].filter(Boolean).join(" | ");
  const runtimeEntries = await listRuntimeReagentKnowledgeEntries();
  const catalog = runtimeEntries.length ? runtimeEntries : staticCatalog;

  const matchedEntries: ReagentKnowledgeMatch[] = catalog
    .map((entry) => {
      const { score, evidence } = scoreKnowledgeEntry(entry, searchText);
      return { entry, score, evidence };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  const topMatches = matchedEntries.slice(0, 5);
  const candidateCategories = uniq(topMatches.map((item) => item.entry.category));
  const candidateSubCategories = uniq(topMatches.map((item) => item.entry.subCategory).filter((item): item is string => Boolean(item)));
  const candidateExperimentTags = uniq(topMatches.flatMap((item) => item.entry.experimentTags));
  const evidenceLines = topMatches.map((item) => `${item.entry.canonicalName}: ${item.evidence.join(", ")}`);
  const retrievalConfidence = topMatches.length ? Math.min(topMatches[0].score / 100, 0.98) : 0;

  return {
    matchedEntries: topMatches,
    candidateCategories,
    candidateSubCategories,
    candidateExperimentTags,
    evidenceLines,
    retrievalConfidence,
  };
}
