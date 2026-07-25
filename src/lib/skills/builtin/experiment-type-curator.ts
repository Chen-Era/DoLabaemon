import type { ExperimentKnowledgeRetrievalResult } from "@/lib/experiment-knowledge/types";

export function buildExperimentSkillHints(retrieval: ExperimentKnowledgeRetrievalResult) {
  const top = retrieval.matchedEntries.slice(0, 3);
  return [
    "优先复用已有实验知识资产与正式代码，不要轻易发明新的正式实验类型。",
    ...top.map((item) => `候选实验: ${item.entry.canonicalName} -> ${item.entry.normalizedCode}`),
    ...retrieval.workflowHints.slice(0, 5).map((item) => `流程提示: ${item}`),
    ...retrieval.requiredTemplateHints.slice(0, 5).map((item) => `最低必需候选: ${item}`),
  ];
}
