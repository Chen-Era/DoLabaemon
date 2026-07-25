import type { ReagentKnowledgeRetrievalResult } from "@/lib/reagent-knowledge/types";

export function buildReagentSkillHints(retrieval: ReagentKnowledgeRetrievalResult) {
  const top = retrieval.matchedEntries.slice(0, 3);
  return [
    "优先维持项目现有试剂分类语义，不要因单一网页线索随意覆盖本地知识。",
    ...top.map((item) => `候选知识: ${item.entry.canonicalName} -> ${item.entry.category}/${item.entry.subCategory ?? "未细分"}`),
    ...top.flatMap((item) => item.entry.experimentTags.slice(0, 4).map((tag) => `候选标签: ${tag}`)),
  ];
}
