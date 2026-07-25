export type SelfCheckInput = {
  retrievalConfidence?: number;
  evidenceLines?: string[];
  sourceCount?: number;
  warnings?: string[];
};

export type SelfCheckResult = {
  ok: boolean;
  score: number;
  warnings: string[];
};

export async function selfCheckMcpTool(input: SelfCheckInput): Promise<SelfCheckResult> {
  const warnings = [...(input.warnings ?? [])];
  let score = 0;

  if ((input.retrievalConfidence ?? 0) >= 0.75) score += 0.45;
  else warnings.push("本地知识检索置信度较低。");

  if ((input.evidenceLines?.length ?? 0) > 0) score += 0.25;
  else warnings.push("缺少可解释的本地证据。");

  if ((input.sourceCount ?? 0) > 0) score += 0.3;
  else warnings.push("未检测到联网来源。");

  return {
    ok: score >= 0.55,
    score: Math.min(score, 1),
    warnings: [...new Set(warnings)],
  };
}
