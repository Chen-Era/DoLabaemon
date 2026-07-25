export type LlmProviderPreset = {
  id: string;
  label: string;
  baseUrl: string;
  model?: string;
  visionModel?: string;
  note?: string;
};

export const CUSTOM_PROVIDER_PRESET_ID = "custom";

// Common OpenAI-compatible providers. Selecting one in the settings page
// pre-fills Base URL and recommended model names; every field stays editable.
export const llmProviderPresets: LlmProviderPreset[] = [
  {
    id: "openai",
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4.1-mini",
    visionModel: "gpt-4.1-mini",
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
  },
  {
    id: "glm",
    label: "智谱 GLM（Coding Plan 可用）",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    model: "glm-4.6",
    visionModel: "glm-4.5v",
  },
  {
    id: "kimi",
    label: "Moonshot Kimi",
    baseUrl: "https://api.moonshot.cn/v1",
    model: "kimi-k2-0905-preview",
  },
  {
    id: "minimax",
    label: "MiniMax",
    baseUrl: "https://api.minimaxi.com/v1",
    model: "MiniMax-M1-80k",
    visionModel: "MiniMax-VL-01",
  },
  {
    id: "qwen",
    label: "阿里百炼 通义千问",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen-plus",
    visionModel: "qwen-vl-plus",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    note: "模型名需按 OpenRouter 的格式填写，例如 openai/gpt-4.1-mini",
  },
];

function normalizeUrlForMatch(url?: string | null) {
  return (url ?? "").trim().toLowerCase().replace(/\/+$/, "");
}

function hostOf(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

/**
 * Find the preset matching a saved Base URL — first by exact URL (ignoring
 * case and trailing slashes), then by host. Returns null for custom setups.
 */
export function matchProviderPreset(baseUrl?: string | null): LlmProviderPreset | null {
  const normalized = normalizeUrlForMatch(baseUrl);
  if (!normalized) return null;

  const exact = llmProviderPresets.find((preset) => normalizeUrlForMatch(preset.baseUrl) === normalized);
  if (exact) return exact;

  const host = hostOf(normalized.startsWith("http") ? normalized : `https://${normalized}`);
  if (!host) return null;
  return llmProviderPresets.find((preset) => hostOf(preset.baseUrl) === host) ?? null;
}
