import { scoreKnowledgeMutationRisk } from "@/lib/knowledge/mutations/risk-score";

export function validateKnowledgeMutation(input: {
  domain: string;
  beforeData?: unknown;
  afterData?: unknown;
  selfCheckOk: boolean;
}) {
  const riskScore = scoreKnowledgeMutationRisk(input);
  const warnings: string[] = [];
  if (!input.selfCheckOk) warnings.push("自检未通过。");
  if (riskScore >= 0.7) warnings.push("本次知识变更风险较高。");

  return {
    ok: input.selfCheckOk && riskScore < 0.85,
    riskScore,
    warnings,
  };
}
