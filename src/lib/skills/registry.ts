export type SkillFlow = "reagent-parse" | "experiment-resolve" | "experiment-check";

export type RuntimeSkillDefinition = {
  id: string;
  name: string;
  description: string;
  domains: string[];
  allowedFlows: SkillFlow[];
  supportsLearning: boolean;
};

export const runtimeSkills: RuntimeSkillDefinition[] = [
  {
    id: "reagent-classification-curator",
    name: "试剂分类扩展助手",
    description: "增强试剂分类、标签与候选证据的解释和学习。",
    domains: ["REAGENT"],
    allowedFlows: ["reagent-parse"],
    supportsLearning: true,
  },
  {
    id: "experiment-type-curator",
    name: "实验类型扩展助手",
    description: "增强实验类型解析、流程阶段和试剂模板候选生成。",
    domains: ["EXPERIMENT"],
    allowedFlows: ["experiment-resolve", "experiment-check"],
    supportsLearning: true,
  },
];

export function listRuntimeSkills(flow?: SkillFlow) {
  return flow ? runtimeSkills.filter((item) => item.allowedFlows.includes(flow)) : runtimeSkills;
}

export function getRuntimeSkill(skillId: string) {
  return runtimeSkills.find((item) => item.id === skillId) ?? null;
}
