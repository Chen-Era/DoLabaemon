import { cleanUrlText } from "@/lib/url/clean-url";

function normalizeBaseUrl(baseUrl?: string | null) {
  return (cleanUrlText(baseUrl) ?? "").toLowerCase();
}

function normalizeModel(model?: string | null) {
  return (model ?? "").trim().toLowerCase();
}

export function getProviderLabel(baseUrl?: string | null) {
  const normalized = normalizeBaseUrl(baseUrl);
  if (!normalized) return "openai";
  if (normalized.includes("api.openai.com")) return "openai";
  if (normalized.includes("minimax")) return "minimax";
  return "custom";
}

export function supportsNativeWebSearch(options?: { baseUrl?: string | null; model?: string | null }) {
  const provider = getProviderLabel(cleanUrlText(options?.baseUrl) ?? cleanUrlText(process.env.OPENAI_BASE_URL));
  const model = normalizeModel(options?.model ?? process.env.OPENAI_MODEL);

  if (provider !== "openai") {
    return false;
  }

  if (!model) {
    return true;
  }

  return /^(gpt-|o\d|oai-)/.test(model);
}

export function getNativeWebSearchToolType(options?: { baseUrl?: string | null; model?: string | null }) {
  return supportsNativeWebSearch(options) ? "web_search_preview" : null;
}
