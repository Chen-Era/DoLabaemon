import { prisma } from "@/lib/prisma";
import { isDemoMode } from "@/lib/demo-mode";
import { demoGetLlmConfig, demoUpsertLlmConfig } from "@/lib/demo-store";
import { cleanUrlText } from "@/lib/url/clean-url";

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
  thinkingEnabled: boolean;
  knowledgeVerifySkipEnabled: boolean;
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
    thinkingEnabled: envBoolean(process.env.LLM_THINKING_ENABLED, false),
    knowledgeVerifySkipEnabled: envBoolean(process.env.LLM_KNOWLEDGE_VERIFY_SKIP_ENABLED, true),
  };
}

function buildRuntimeConfig(saved?: UserLlmConfigInput | null): RuntimeLlmConfig {
  const env = getEnvConfig();
  return {
    apiKey: cleanText(saved?.openaiApiKey) ?? env.openaiApiKey ?? null,
    baseURL: cleanUrlText(saved?.openaiBaseUrl) ?? env.openaiBaseUrl ?? null,
    model: cleanText(saved?.openaiModel) ?? env.openaiModel ?? "MiniMax-M1-80k",
    visionModel: cleanText(saved?.openaiVisionModel) ?? cleanText(saved?.openaiModel) ?? env.openaiVisionModel ?? env.openaiModel ?? "MiniMax-VL-01",
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
    thinkingEnabled: saved?.thinkingEnabled ?? env.thinkingEnabled ?? false,
    knowledgeVerifySkipEnabled: saved?.knowledgeVerifySkipEnabled ?? env.knowledgeVerifySkipEnabled ?? true,
  };
}

export async function getUserLlmConfig(userId: string) {
  if (isDemoMode()) {
    return demoGetLlmConfig(userId);
  }
  return prisma.userLlmConfig.findUnique({ where: { userId } });
}

export async function getRuntimeLlmConfigForUser(userId: string): Promise<RuntimeLlmConfig> {
  const saved = await getUserLlmConfig(userId);
  return buildRuntimeConfig(saved);
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
    thinkingEnabled: input.thinkingEnabled ?? current?.thinkingEnabled ?? false,
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
      thinkingEnabled: saved?.thinkingEnabled ?? null,
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
      thinkingEnabled: runtime.thinkingEnabled,
      knowledgeVerifySkipEnabled: runtime.knowledgeVerifySkipEnabled,
      hasApiKey: Boolean(runtime.apiKey),
      hasSearchApiKey: Boolean(runtime.searchApiKey),
    },
  };
}
