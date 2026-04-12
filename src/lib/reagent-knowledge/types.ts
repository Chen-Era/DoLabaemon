import type { ExperimentTag } from "@/lib/rules/catalog";
import type { ReagentCategory } from "@/lib/reagent-tagging";

export type ReagentKnowledgeEvidenceType = "exact_alias" | "pattern" | "keyword_family";

export type ReagentKnowledgeEntry = {
  id: string;
  canonicalName: string;
  aliases: string[];
  category: ReagentCategory;
  subCategory: string | null;
  experimentTags: ExperimentTag[];
  namePatterns: string[];
  requiredKeywords: string[];
  excludedKeywords: string[];
  vendorHints: string[];
  evidenceType: ReagentKnowledgeEvidenceType;
  confidenceHint: number;
  notes?: string;
};

export type ReagentKnowledgeCatalog = ReagentKnowledgeEntry[];

export type ReagentKnowledgeMatch = {
  entry: ReagentKnowledgeEntry;
  score: number;
  evidence: string[];
};

export type ReagentKnowledgeRetrievalResult = {
  matchedEntries: ReagentKnowledgeMatch[];
  candidateCategories: ReagentCategory[];
  candidateSubCategories: string[];
  candidateExperimentTags: ExperimentTag[];
  evidenceLines: string[];
  retrievalConfidence: number;
};
