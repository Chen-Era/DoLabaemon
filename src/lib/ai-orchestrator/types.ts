import type { RuntimeLlmConfig } from "@/lib/llm/runtime-config";
import type { SkillFlow } from "@/lib/skills/registry";

export type AiFlowContext = {
  flow: SkillFlow;
  labId: string;
  userId: string;
  role: "PI" | "ADMIN" | "MEMBER";
  llmConfig: RuntimeLlmConfig;
};

export type AiFlowExecution = {
  enabledSkills: string[];
  enabledMcpServers: string[];
  selfCheckEnabled: boolean;
  autoLearnEnabled: boolean;
};
