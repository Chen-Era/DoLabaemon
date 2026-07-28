import { prisma } from "@/lib/prisma";
import { isDemoMode } from "@/lib/demo-mode";
import { demoDeleteLlmConfig, demoGetLlmConfig, demoUpsertLlmConfig } from "@/lib/demo-store";
import type { ReasoningEffort } from "@/lib/llm/reasoning-effort";
import { DEFAULT_REASONING_EFFORT, envReasoningEffort, reasoningEffortFromLegacyConfig } from "@/lib/llm/reasoning-effort";
import { cleanUrlText } from "@/lib/url/clean-url";
import { getLabLlmRuntimeOverride } from "@/lib/llm/lab-config";
import { assertLabAccess } from "@/lib/permissions";

// Built-in skills enabled by default when LLM_ENABLED_SKILLS is unset.
// 与 src/lib/skills/registry.ts 保持同步（新增内置 skill 时同步更新此列表）。
const DEFAULT_ENABLED_SKILLS = ["reagent-classification-curator", "experiment-type-curator", "reagent-parse-output"];

export type UserLlmConfigInput = {
  openaiApiKey?: string | null;
  openaiBaseUrl?: string | null;
  openaiModel?: string | null;
  openaiVisionModel?: string | null;
  searchEnabled?: boolean;
  searchProvider?: string | null;
  searchApiKey?: string | null;
  searchBaseUrl?: string | null;
  enabledSkills?: string[];
  enabledMcpServers?: string[];
  selfCheckEnabled?: boolean;
  autoLearnEnabled?: boolean;
  reasoningEffort?: ReasoningEffort | null;
  // Legacy demo-store records may still have this field. Production records
  // are converted by the Prisma migration and never write it back.
  thinkingEnabled?: boolean | null;
  knowledgeVerifySkipEnabled?: boolean | null;
};

export type RuntimeLlmConfig = {
  apiKey?: string | null;
  baseURL?: string | null;
  model: string;
  visionModel: string;
  searchEnabled: boolean;
  searchProvider?: string | null;
  searchApiKey?: string | null;
  searchBaseURL?: string | null;
  enabledSkills: string[];
  enabledMcpServers: string[];
  selfCheckEnabled: boolean;
  autoLearnEnabled: boolean;
  reasoningEffort: ReasoningEffort;
  knowledgeVerifySkipEnabled: boolean;
  /** Never expose credentials; this is only a safe diagnostics label. */
  source: "lab" | "user" | "environment";
};

function cleanText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function cleanList(value: string[] | null | undefined) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => item.trim()).filter(Boolean))];
}

function envBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined) return fallback;
  return value !== "false";
}

function getEnvConfig(): UserLlmConfigInput {
  return {
    openaiApiKey: cleanText(process.env.OPENAI_API_KEY),
    openaiBaseUrl: cleanUrlText(process.env.OPENAI_BASE_URL),
    openaiModel: cleanText(process.env.OPENAI_MODEL),
    openaiVisionModel: cleanText(process.env.OPENAI_VISION_MODEL || process.env.OPENAI_IMAGE_MODEL),
    searchEnabled: envBoolean(process.env.REAGENT_SEARCH_ENABLED, true),
    searchProvider: cleanText(process.env.REAGENT_SEARCH_PROVIDER),
    searchApiKey: cleanText(process.env.REAGENT_SEARCH_API_KEY),
    searchBaseUrl: cleanUrlText(process.env.REAGENT_SEARCH_BASE_URL),
    enabledSkills:
      process.env.LLM_ENABLED_SKILLS === undefined ? DEFAULT_ENABLED_SKILLS : cleanList(process.env.LLM_ENABLED_SKILLS.split(",")),
    enabledMcpServers: cleanList(process.env.LLM_ENABLED_MCP_SERVERS?.split(",")),
    selfCheckEnabled: envBoolean(process.env.LLM_SELF_CHECK_ENABLED, true),
    autoLearnEnabled: envBoolean(process.env.LLM_AUTO_LEARN_ENABLED, false),
    reasoningEffort: envReasoningEffort() ?? DEFAULT_REASONING_EFFORT,
    knowledgeVerifySkipEnabled: envBoolean(process.env.LLM_KNOWLEDGE_VERIFY_SKIP_ENABLED, true),
  };
}

function buildRuntimeConfig(saved?: UserLlmConfigInput | null): RuntimeLlmConfig {
  const env = getEnvConfig();
  return {
    apiKey: cleanText(saved?.openaiApiKey) ?? env.openaiApiKey ?? null,
    baseURL: cleanUrlText(saved?.openaiBaseUrl) ?? env.openaiBaseUrl ?? null,
    model: cleanText(saved?.openaiModel) ?? env.openaiModel ?? "",
    visionModel: cleanText(saved?.openaiVisionModel) ?? cleanText(saved?.openaiModel) ?? env.openaiVisionModel ?? env.openaiModel ?? "",
    searchEnabled: saved?.searchEnabled ?? env.searchEnabled ?? true,
    searchProvider: cleanText(saved?.searchProvider) ?? env.searchProvider ?? null,
    searchApiKey: cleanText(saved?.searchApiKey) ?? env.searchApiKey ?? null,
    searchBaseURL: cleanUrlText(saved?.searchBaseUrl) ?? env.searchBaseUrl ?? null,
    enabledSkills: cleanList(saved?.enabledSkills).length ? cleanList(saved?.enabledSkills) : cleanList(env.enabledSkills),
    enabledMcpServers: cleanList(saved?.enabledMcpServers).length
      ? cleanList(saved?.enabledMcpServers)
      : cleanList(env.enabledMcpServers),
    selfCheckEnabled: saved?.selfCheckEnabled ?? env.selfCheckEnabled ?? true,
    autoLearnEnabled: saved?.autoLearnEnabled ?? env.autoLearnEnabled ?? false,
    reasoningEffort: reasoningEffortFromLegacyConfig(saved) ?? env.reasoningEffort ?? DEFAULT_REASONING_EFFORT,
    knowledgeVerifySkipEnabled: saved?.knowledgeVerifySkipEnabled ?? env.knowledgeVerifySkipEnabled ?? true,
    source: saved ? "user" : "environment",
  };
}

export async function getUserLlmConfig(userId: string) {
  if (isDemoMode()) {
    return demoGetLlmConfig(userId);
  }
  return prisma.userLlmConfig.findUnique({ where: { userId } });
}

export async function getRuntimeLlmConfigForUser(userId: string): Promise<RuntimeLlmConfig> {
  const saved = (await getUserLlmConfig(userId)) as UserLlmConfigInput | null;
  return buildRuntimeConfig(saved);
}

function hasPersonalLlmApiKey(saved: UserLlmConfigInput | null) {
  return Boolean(cleanText(saved?.openaiApiKey));
}

/**
 * Resolve model credentials in the context of exactly one lab membership.
 * A member's explicitly saved API key takes precedence. Otherwise, an enabled
 * shared credential is an atomic fallback: its key, endpoint, models and
 * reasoning control always come from the same lab record.
 */
export async function getRuntimeLlmConfigForLabMember(userId: string, labId: string): Promise<RuntimeLlmConfig> {
  await assertLabAccess(userId, labId);
  const saved = (await getUserLlmConfig(userId)) as UserLlmConfigInput | null;
  const personalOrEnvironment = buildRuntimeConfig(saved);
  if (hasPersonalLlmApiKey(saved)) return personalOrEnvironment;

  const labOverride = await getLabLlmRuntimeOverride(labId);
  if (!labOverride) return personalOrEnvironment;
  return {
    ...personalOrEnvironment,
    ...labOverride,
    source: "lab",
  };
}

export async function upsertUserLlmConfig(userId: string, input: UserLlmConfigInput) {
  const current = (await getUserLlmConfig(userId)) as UserLlmConfigInput | null;
  const next = {
    openaiApiKey: cleanText(input.openaiApiKey) ?? current?.openaiApiKey ?? null,
    openaiBaseUrl: cleanUrlText(input.openaiBaseUrl),
    openaiModel: cleanText(input.openaiModel),
    openaiVisionModel: cleanText(input.openaiVisionModel),
    searchEnabled: input.searchEnabled ?? current?.searchEnabled ?? true,
    searchProvider: cleanText(input.searchProvider),
    searchApiKey: cleanText(input.searchApiKey) ?? current?.searchApiKey ?? null,
    searchBaseUrl: cleanUrlText(input.searchBaseUrl),
    enabledSkills: cleanList(input.enabledSkills),
    enabledMcpServers: cleanList(input.enabledMcpServers),
    selfCheckEnabled: input.selfCheckEnabled ?? current?.selfCheckEnabled ?? true,
    autoLearnEnabled: input.autoLearnEnabled ?? current?.autoLearnEnabled ?? false,
    reasoningEffort: reasoningEffortFromLegacyConfig(input) ?? reasoningEffortFromLegacyConfig(current) ?? DEFAULT_REASONING_EFFORT,
    knowledgeVerifySkipEnabled: input.knowledgeVerifySkipEnabled ?? current?.knowledgeVerifySkipEnabled ?? true,
  };

  if (isDemoMode()) {
    return demoUpsertLlmConfig(userId, next);
  }

  return prisma.userLlmConfig.upsert({
    where: { userId },
    create: { userId, ...next },
    update: next,
  });
}

/** Remove every user-scoped model and tool preference, including saved secrets. */
export async function deleteUserLlmConfig(userId: string) {
  if (isDemoMode()) {
    return demoDeleteLlmConfig(userId);
  }
  await prisma.userLlmConfig.deleteMany({ where: { userId } });
}

export async function getLlmConfigView(userId: string) {
  const saved = (await getUserLlmConfig(userId)) as UserLlmConfigInput | null;
  const runtime = buildRuntimeConfig(saved);
  return {
    saved: {
      openaiBaseUrl: cleanUrlText(saved?.openaiBaseUrl),
      openaiModel: cleanText(saved?.openaiModel),
      openaiVisionModel: cleanText(saved?.openaiVisionModel),
      searchEnabled: saved?.searchEnabled ?? null,
      searchProvider: cleanText(saved?.searchProvider),
      searchBaseUrl: cleanUrlText(saved?.searchBaseUrl),
      enabledSkills: cleanList(saved?.enabledSkills),
      enabledMcpServers: cleanList(saved?.enabledMcpServers),
      selfCheckEnabled: saved?.selfCheckEnabled ?? null,
      autoLearnEnabled: saved?.autoLearnEnabled ?? null,
      reasoningEffort: reasoningEffortFromLegacyConfig(saved),
      knowledgeVerifySkipEnabled: saved?.knowledgeVerifySkipEnabled ?? null,
      hasOpenaiApiKey: Boolean(cleanText(saved?.openaiApiKey)),
      hasSearchApiKey: Boolean(cleanText(saved?.searchApiKey)),
    },
    runtime: {
      baseURL: runtime.baseURL,
      model: runtime.model,
      visionModel: runtime.visionModel,
      searchEnabled: runtime.searchEnabled,
      searchProvider: runtime.searchProvider,
      enabledSkills: runtime.enabledSkills,
      enabledMcpServers: runtime.enabledMcpServers,
      selfCheckEnabled: runtime.selfCheckEnabled,
      autoLearnEnabled: runtime.autoLearnEnabled,
      reasoningEffort: runtime.reasoningEffort,
      knowledgeVerifySkipEnabled: runtime.knowledgeVerifySkipEnabled,
      hasApiKey: Boolean(runtime.apiKey),
      hasSearchApiKey: Boolean(runtime.searchApiKey),
    },
  };
}
