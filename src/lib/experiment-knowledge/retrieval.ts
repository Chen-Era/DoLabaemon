import rawCatalog from "@/lib/experiment-knowledge/catalog.json";
import { scoreExperimentKnowledgeEntry } from "@/lib/experiment-knowledge/scoring";
import type {
  ExperimentKnowledgeCatalog,
  ExperimentKnowledgeMatch,
  ExperimentKnowledgeRetrievalResult,
} from "@/lib/experiment-knowledge/types";

const experimentKnowledgeCatalog = rawCatalog as ExperimentKnowledgeCatalog;

function uniq<T>(items: T[]) {
  return [...new Set(items)];
}

export function retrieveExperimentKnowledge(input: {
  customExperimentName: string;
  experimentContext?: string | null;
  directionCode?: string | null;
}): ExperimentKnowledgeRetrievalResult {
  const searchText = [input.customExperimentName, input.experimentContext].filter(Boolean).join(" | ");
  const matchedEntries: ExperimentKnowledgeMatch[] = experimentKnowledgeCatalog
    .map((entry) => {
      const { score, evidence } = scoreExperimentKnowledgeEntry(entry, searchText, input.directionCode ?? undefined);
      return { entry, score, evidence };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  const topMatches = matchedEntries.slice(0, 5);
  const candidateCodes = uniq(topMatches.map((item) => item.entry.normalizedCode));
  const workflowHints = uniq(topMatches.flatMap((item) => item.entry.workflowStages.map((stage) => stage.labelZh)));
  const requiredTemplateHints = uniq(
    topMatches.flatMap((item) => item.entry.requiredReagentTemplates.map((template) => template.nameZh)),
  );
  const recommendedTemplateHints = uniq(
    topMatches.flatMap((item) => item.entry.recommendedReagentTemplates.map((template) => template.nameZh)),
  );
  const evidenceLines = topMatches.map((item) => `${item.entry.canonicalName}: ${item.evidence.join(", ")}`);
  const retrievalConfidence = topMatches.length ? Math.min(topMatches[0].score / 100, 0.98) : 0;

  return {
    matchedEntries: topMatches,
    candidateCodes,
    workflowHints,
    requiredTemplateHints,
    recommendedTemplateHints,
    evidenceLines,
    retrievalConfidence,
  };
}
