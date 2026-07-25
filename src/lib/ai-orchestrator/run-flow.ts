import { canAutoLearnWithPolicy, getLabAiPolicy, type KnowledgeDomain } from "@/lib/ai-policy";
import { applyKnowledgeMutation } from "@/lib/knowledge/mutations/apply";
import { listRuntimeMcpServers } from "@/lib/mcp/registry";
import { runSelfCheck } from "@/lib/self-check/run";
import type { AiFlowContext, AiFlowExecution } from "@/lib/ai-orchestrator/types";
import { listRuntimeSkills } from "@/lib/skills/registry";

export async function prepareAiFlow(context: AiFlowContext): Promise<AiFlowExecution> {
  const availableSkills = listRuntimeSkills(context.flow).map((item) => item.id);
  const availableMcpServers: string[] = listRuntimeMcpServers().map((item) => item.id);

  return {
    enabledSkills: context.llmConfig.enabledSkills.filter((item) => availableSkills.includes(item)),
    enabledMcpServers: context.llmConfig.enabledMcpServers.filter((item) => availableMcpServers.includes(item)),
    selfCheckEnabled: context.llmConfig.selfCheckEnabled,
    autoLearnEnabled: context.llmConfig.autoLearnEnabled,
  };
}

export async function finalizeAiFlow(input: {
  context: AiFlowContext;
  domain: KnowledgeDomain;
  entityKey: string;
  beforeData?: unknown;
  afterData?: unknown;
  evidenceLines?: string[];
  retrievalConfidence?: number;
  sourceCount?: number;
  warnings?: string[];
}) {
  const execution = await prepareAiFlow(input.context);
  const selfCheck = await runSelfCheck({
    enabled: execution.selfCheckEnabled,
    retrievalConfidence: input.retrievalConfidence,
    evidenceLines: input.evidenceLines,
    sourceCount: input.sourceCount,
    warnings: input.warnings,
  });
  const policy = await getLabAiPolicy(input.context.labId);
  const canAutoLearn = canAutoLearnWithPolicy({
    policy: {
      allowAutoLearn: policy?.allowAutoLearn ?? false,
      allowedRoles: (policy?.allowedRoles as Array<"PI" | "ADMIN" | "MEMBER"> | undefined) ?? ["PI"],
      enabledKnowledgeDomains: policy?.enabledKnowledgeDomains ?? ["REAGENT", "EXPERIMENT"],
    },
    role: input.context.role,
    domain: input.domain,
    autoLearnEnabled: execution.autoLearnEnabled,
  });

  const learning = canAutoLearn
    ? await applyKnowledgeMutation({
        labId: input.context.labId,
        userId: input.context.userId,
        flowType: input.context.flow,
        domain: input.domain,
        entityKey: input.entityKey,
        beforeData: input.beforeData,
        afterData: input.afterData,
        evidenceSummary: input.evidenceLines,
        modelName: input.context.llmConfig.model,
        selfCheckOk: selfCheck.ok,
      })
    : null;

  return {
    execution,
    selfCheck,
    canAutoLearn,
    learning,
  };
}
