import { invokeMcpTool } from "@/lib/mcp/client";

export async function runSelfCheck(input: {
  enabled: boolean;
  retrievalConfidence?: number;
  evidenceLines?: string[];
  sourceCount?: number;
  warnings?: string[];
}) {
  if (!input.enabled) {
    return {
      ok: false,
      score: 0,
      warnings: ["已关闭自检。"],
    };
  }

  return invokeMcpTool("self_check_result", {
    retrievalConfidence: input.retrievalConfidence,
    evidenceLines: input.evidenceLines,
    sourceCount: input.sourceCount,
    warnings: input.warnings,
  });
}
