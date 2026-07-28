import { isDemoMode } from "@/lib/demo-mode";
import { demoDeleteLabLlmConfig, demoGetLabLlmConfig, demoUpsertLabLlmConfig } from "@/lib/demo-store";
import { prisma } from "@/lib/prisma";
import type { ReasoningEffort } from "@/lib/llm/reasoning-effort";
import { DEFAULT_REASONING_EFFORT, normalizeReasoningEffort } from "@/lib/llm/reasoning-effort";
import { cleanUrlText } from "@/lib/url/clean-url";
import { decryptLabLlmSecret, encryptLabLlmSecret } from "@/lib/llm/lab-secret-crypto";

export type LabLlmConfigInput = {
  openaiApiKey?: string | null;
  openaiBaseUrl?: string | null;
  openaiModel?: string | null;
  openaiVisionModel?: string | null;
  reasoningEffort?: ReasoningEffort | null;
  isEnabled?: boolean;
};

export type LabLlmRuntimeOverride = {
  apiKey: string;
  baseURL: string | null;
  model: string;
  visionModel: string;
  reasoningEffort: ReasoningEffort;
};

type StoredLabLlmConfig = {
  labId: string;
  encryptedOpenaiApiKey: string;
  openaiBaseUrl: string | null;
  openaiModel: string;
  openaiVisionModel: string | null;
  reasoningEffort: string;
  isEnabled: boolean;
};

function cleanText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeEffort(value: ReasoningEffort | string | null | undefined) {
  return normalizeReasoningEffort(value) ?? DEFAULT_REASONING_EFFORT;
}

export async function getLabLlmConfig(labId: string): Promise<StoredLabLlmConfig | null> {
  if (isDemoMode()) return demoGetLabLlmConfig(labId);
  return prisma.labLlmConfig.findUnique({ where: { labId } });
}

/** A DTO: deliberately contains no encrypted secret and no plaintext secret. */
export async function getLabLlmConfigView(labId: string) {
  const saved = await getLabLlmConfig(labId);
  return {
    enabled: saved?.isEnabled ?? false,
    configured: Boolean(saved?.isEnabled && saved.encryptedOpenaiApiKey && saved.openaiModel),
    openaiBaseUrl: cleanUrlText(saved?.openaiBaseUrl),
    openaiModel: cleanText(saved?.openaiModel),
    openaiVisionModel: cleanText(saved?.openaiVisionModel),
    reasoningEffort: normalizeEffort(saved?.reasoningEffort),
    hasOpenaiApiKey: Boolean(saved?.encryptedOpenaiApiKey),
  };
}

export async function upsertLabLlmConfig(labId: string, input: LabLlmConfigInput) {
  const current = await getLabLlmConfig(labId);
  const suppliedApiKey = cleanText(input.openaiApiKey);
  const openaiModel = cleanText(input.openaiModel) ?? cleanText(current?.openaiModel);
  const encryptedOpenaiApiKey = suppliedApiKey
    ? encryptLabLlmSecret(suppliedApiKey)
    : current?.encryptedOpenaiApiKey;

  if (!encryptedOpenaiApiKey) throw new Error("LAB_LLM_API_KEY_REQUIRED");
  if (!openaiModel) throw new Error("LAB_LLM_MODEL_REQUIRED");

  const next: StoredLabLlmConfig = {
    labId,
    encryptedOpenaiApiKey,
    openaiBaseUrl: input.openaiBaseUrl === undefined ? current?.openaiBaseUrl ?? null : cleanUrlText(input.openaiBaseUrl),
    openaiModel,
    openaiVisionModel: input.openaiVisionModel === undefined ? current?.openaiVisionModel ?? null : cleanText(input.openaiVisionModel),
    reasoningEffort: normalizeEffort(input.reasoningEffort ?? current?.reasoningEffort),
    isEnabled: input.isEnabled ?? current?.isEnabled ?? true,
  };

  if (isDemoMode()) return demoUpsertLabLlmConfig(next);
  return prisma.labLlmConfig.upsert({
    where: { labId },
    create: next,
    update: next,
  });
}

export async function deleteLabLlmConfig(labId: string) {
  if (isDemoMode()) return demoDeleteLabLlmConfig(labId);
  await prisma.labLlmConfig.deleteMany({ where: { labId } });
}

/** Returns a decrypted model credential only to the server-side call path. */
export async function getLabLlmRuntimeOverride(labId: string): Promise<LabLlmRuntimeOverride | null> {
  const saved = await getLabLlmConfig(labId);
  if (!saved?.isEnabled || !saved.encryptedOpenaiApiKey || !cleanText(saved.openaiModel)) return null;

  const apiKey = cleanText(decryptLabLlmSecret(saved.encryptedOpenaiApiKey));
  if (!apiKey) throw new Error("LAB_LLM_SECRET_INVALID");
  const model = cleanText(saved.openaiModel)!;
  return {
    apiKey,
    baseURL: cleanUrlText(saved.openaiBaseUrl),
    model,
    visionModel: cleanText(saved.openaiVisionModel) ?? model,
    reasoningEffort: normalizeEffort(saved.reasoningEffort),
  };
}
