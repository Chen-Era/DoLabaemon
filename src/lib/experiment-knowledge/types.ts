import type { ExperimentTag, MatcherTypeValue, RuleLevelValue } from "@/lib/rules/catalog";

export type ExperimentKnowledgeSource = "SYSTEM" | "CURATED" | "SUGGESTED";

export type ExperimentKnowledgeTemplate = {
  nameZh: string;
  nameEn: string;
  level: RuleLevelValue;
  matcherType: MatcherTypeValue;
  matcherValues: string[];
  matcherAntibodyRole?: "PRIMARY" | "SECONDARY";
};

export type ExperimentWorkflowStage = {
  key: string;
  labelZh: string;
  labelEn: string;
  relatedExperimentTags: ExperimentTag[];
};

export type ExperimentKnowledgeEntry = {
  id: string;
  canonicalName: string;
  aliases: string[];
  normalizedCode: string;
  descriptionZh: string;
  descriptionEn: string;
  supportedDirections: string[];
  workflowStages: ExperimentWorkflowStage[];
  requiredReagentTemplates: ExperimentKnowledgeTemplate[];
  recommendedReagentTemplates: ExperimentKnowledgeTemplate[];
  evidenceKeywords: string[];
  excludedKeywords: string[];
  relatedExperimentTags: ExperimentTag[];
  source: ExperimentKnowledgeSource;
};

export type ExperimentKnowledgeCatalog = ExperimentKnowledgeEntry[];

export type ExperimentKnowledgeMatch = {
  entry: ExperimentKnowledgeEntry;
  score: number;
  evidence: string[];
};

export type ExperimentKnowledgeRetrievalResult = {
  matchedEntries: ExperimentKnowledgeMatch[];
  candidateCodes: string[];
  workflowHints: string[];
  requiredTemplateHints: string[];
  recommendedTemplateHints: string[];
  evidenceLines: string[];
  retrievalConfidence: number;
};

export type ExperimentResolutionSuggestion = {
  proposedExperimentName: string;
  proposedExperimentCode?: string | null;
  matchedExistingCode?: string | null;
  workflowStages: string[];
  minRequiredItems: Array<{ name: string; matcherType: string; matcherValues: string[] }>;
  recommendedItems: Array<{ name: string; matcherType: string; matcherValues: string[] }>;
  warnings: string[];
  rationale?: string | null;
  confidence: number;
};

export type ExperimentResolution = {
  resolvedExperimentType?: string | null;
  resolutionSource: "DIRECT" | "ALIAS_MATCH" | "MODEL_SUGGESTION";
  resolutionConfidence: number;
  needsConfirmation: boolean;
  warnings: string[];
  suggestion?: ExperimentResolutionSuggestion | null;
};
