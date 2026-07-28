import OpenAI from "openai";
import type { ReasoningEffort } from "@/lib/llm/reasoning-effort";
import { DEFAULT_REASONING_EFFORT, normalizeReasoningEffort } from "@/lib/llm/reasoning-effort";
import type { RuntimeLlmConfig } from "@/lib/llm/runtime-config";
import { cleanUrlText } from "@/lib/url/clean-url";

type LlmMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type GenerateTextOptions = {
  model: string;
  input: LlmMessage[];
  temperature?: number;
  includeSources?: boolean;
};

type GenerateTextResult = {
  text: string;
  sources: string[];
};

function normalizeBaseUrl(baseURL?: string | null) {
  return (cleanUrlText(baseURL) ?? "").toLowerCase();
}

function getProvider(baseURL?: string | null) {
  const normalized = normalizeBaseUrl(baseURL);
  if (!normalized) return "openai";
  if (normalized.includes("api.openai.com")) return "openai";
  if (normalized.includes("minimax")) return "minimax";
  return "custom";
}

// Reasoning controls are spelled differently by every provider, and only some
// accept a real effort level:
// OpenAI's Responses API takes reasoning.effort directly; OpenRouter takes
// reasoning.enabled plus the same effort levels; DashScope has no effort but
// accepts a thinking_budget in tokens, so the levels map onto budgets (an
// out-of-range rejection names the param and is dropped by the param-fallback
// retry below); GLM (bigmodel) takes a thinking on/off object; DeepSeek and
// Kimi use model-specific controls; and MiniMax M1 cannot disable thinking — its
// reasoning_split flag (added below) only keeps <think> out of the JSON
// content, so no reasoning param is sent regardless of the level.
const DASHSCOPE_THINKING_BUDGET: Record<Exclude<ReasoningEffort, "off">, number> = {
  low: 1024,
  medium: 8192,
  high: 32768,
};

function normalizedModelName(model?: string | null) {
  return model?.trim().toLowerCase() ?? "";
}

function isMiMoV25Model(model: string) {
  return /(?:xiaomi\/)?mimo-(?:v)?2\.5(?:-pro)?/.test(model);
}

export function getLlmReasoningRequestControls(input: {
  baseURL?: string | null;
  model?: string | null;
  reasoningEffort?: ReasoningEffort | null;
}) {
  const { baseURL, model } = input;
  const effort = normalizeReasoningEffort(input.reasoningEffort) ?? DEFAULT_REASONING_EFFORT;
  const normalized = normalizeBaseUrl(baseURL);
  const provider = getProvider(baseURL);
  const normalizedModel = normalizedModelName(model);
  const enabled = effort !== "off";
  if (isMiMoV25Model(normalizedModel)) {
    // MiMo V2.5 models expose a binary thinking switch only. They explicitly
    // reject reasoning_effort and thinking_budget, so the global non-off
    // levels all mean "enabled at the provider's default intensity".
    const usesNativeMiMoApi = normalized.includes("xiaomimimo");
    return {
      reasoningParams: usesNativeMiMoApi
        ? { thinking: { type: enabled ? "enabled" : "disabled" } }
        : { enable_thinking: enabled },
      // The native V2.5 thinking API fixes temperature internally; omit it
      // when reasoning is enabled instead of claiming a custom value applies.
      omitTemperature: usesNativeMiMoApi && enabled,
    };
  }
  if (provider === "openai") {
    return { reasoningParams: enabled ? { reasoning: { effort } } : {}, omitTemperature: false };
  }
  if (provider === "minimax") {
    return { reasoningParams: {}, omitTemperature: false };
  }
  if (normalized.includes("dashscope")) {
    return {
      reasoningParams: enabled ? { enable_thinking: true, thinking_budget: DASHSCOPE_THINKING_BUDGET[effort] } : { enable_thinking: false },
      omitTemperature: false,
    };
  }
  if (normalized.includes("bigmodel")) {
    return { reasoningParams: { thinking: { type: enabled ? "enabled" : "disabled" } }, omitTemperature: false };
  }
  if (normalized.includes("openrouter")) {
    return { reasoningParams: enabled ? { reasoning: { enabled: true, effort } } : { reasoning: { enabled: false } }, omitTemperature: false };
  }
  if (normalized.includes("deepseek")) {
    // DeepSeek V4 accepts high/max only. Mapping low/medium to high keeps the
    // requested ordering without sending unsupported values; legacy models
    // can reject the optional fields and use the shared fallback below.
    return {
      reasoningParams: enabled
        ? { thinking: { type: "enabled" }, reasoning_effort: "high" }
        : { thinking: { type: "disabled" } },
      omitTemperature: false,
    };
  }
  if (normalized.includes("moonshot")) {
    const temperatureLocked = normalizedModel.startsWith("kimi-k2.6") || normalizedModel.startsWith("kimi-k2.7-code");
    if (normalizedModel.startsWith("kimi-k3")) {
      // K3 always reasons and rejects thinking. "off" cannot be represented.
      return {
        reasoningParams: enabled ? { reasoning_effort: effort === "low" ? "low" : "high" } : {},
        omitTemperature: false,
      };
    }
    if (normalizedModel.startsWith("kimi-k2.7-code")) {
      // This model always reasons and accepts no reasoning control fields.
      return { reasoningParams: {}, omitTemperature: temperatureLocked };
    }
    if (normalizedModel.startsWith("kimi-k2.6") || normalizedModel.startsWith("kimi-k2.5")) {
      return {
        reasoningParams: { thinking: { type: enabled ? "enabled" : "disabled" } },
        omitTemperature: temperatureLocked,
      };
    }
    return { reasoningParams: {}, omitTemperature: false };
  }
  // Self-hosted OpenAI-compatible endpoints (MiMo / vLLM / Ollama / ...)
  // disagree on where the switch lives, so write both the top-level param and
  // the chat-template kwarg; whichever the server rejects gets dropped by the
  // param-fallback retry below.
  return {
    reasoningParams: {
      enable_thinking: enabled,
      chat_template_kwargs: { enable_thinking: enabled },
    },
    omitTemperature: false,
  };
}

function formatInputForResponses(messages: LlmMessage[]) {
  return messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));
}

function formatInputForChat(messages: LlmMessage[]) {
  return messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));
}

function extractTextFromChat(response: unknown) {
  const content = (response as { choices?: Array<{ message?: { content?: unknown } }> })?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        const typedPart = part as { type?: string; text?: string };
        return typedPart?.type === "text" ? typedPart.text ?? "" : "";
      })
      .join("")
      .trim();
  }
  return "";
}

// OpenAI-compatible providers reject request params they do not support
// (e.g. temperature=0 on some platforms, reasoning_split on others, custom
// temperature on OpenAI reasoning models). When the error message names the
// offending parameter, drop it and retry once per parameter instead of
// failing the whole parse. The same mechanism covers the thinking params
// (enable_thinking / chat_template_kwargs / thinking / reasoning): they are
// sent optimistically and dropped only if the server complains about them.
function namesUnsupportedParam(error: unknown, param: string) {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  // Several OpenAI-compatible servers report the nested field name rather
  // than its chat-template parent. The top-level enable_thinking field is
  // removed first; on the next retry this removes the remaining wrapper.
  if (param === "chat_template_kwargs" && message.includes("enable_thinking")) return true;
  return message.includes(param.toLowerCase());
}

async function createWithParamFallback<T>(
  create: (body: Record<string, unknown>) => Promise<T>,
  body: Record<string, unknown>,
  droppableParams: string[],
): Promise<T> {
  const params = { ...body };
  for (;;) {
    try {
      return await create(params);
    } catch (error) {
      const offending = droppableParams.find((param) => param in params && namesUnsupportedParam(error, param));
      if (!offending) throw error;
      delete params[offending];
    }
  }
}

const CHAT_COMPLETION_DROPPABLE_PARAMS = [
  "reasoning_split",
  "temperature",
  "enable_thinking",
  "thinking_budget",
  "chat_template_kwargs",
  "thinking",
  "reasoning",
  "reasoning_effort",
];

export function getLlmClient(config?: Pick<RuntimeLlmConfig, "apiKey" | "baseURL">) {
  const apiKey = config?.apiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY missing");
  }
  const baseURL = cleanUrlText(config?.baseURL) ?? cleanUrlText(process.env.OPENAI_BASE_URL) ?? undefined;
  return new OpenAI({
    apiKey,
    baseURL,
  });
}

// Keep direct chat-completion callers (notably visual OCR) on the same
// provider compatibility and fallback path as text generation.
export async function createChatCompletionWithParamFallback(
  client: ReturnType<typeof getLlmClient>,
  requestBody: Record<string, unknown>,
  requestOptions?: Parameters<ReturnType<typeof getLlmClient>["chat"]["completions"]["create"]>[1],
) {
  return createWithParamFallback(
    (body) => client.chat.completions.create(body as unknown as Parameters<typeof client.chat.completions.create>[0], requestOptions),
    requestBody,
    CHAT_COMPLETION_DROPPABLE_PARAMS,
  );
}

export async function generateLlmText(
  client: ReturnType<typeof getLlmClient>,
  config: (Pick<RuntimeLlmConfig, "baseURL"> & { reasoningEffort?: ReasoningEffort | null }) | undefined,
  options: GenerateTextOptions,
): Promise<GenerateTextResult> {
  const provider = getProvider(config?.baseURL);
  const { reasoningParams, omitTemperature } = getLlmReasoningRequestControls({
    baseURL: config?.baseURL,
    model: options.model,
    reasoningEffort: config?.reasoningEffort,
  });

  if (provider === "openai") {
    const requestBody = {
      model: options.model,
      input: formatInputForResponses(options.input),
      temperature: options.temperature ?? 0,
      ...reasoningParams,
      // includeSources implies the caller enabled native web search; the tool
      // must be declared or the API errors out / never returns sources.
      ...(options.includeSources
        ? { tools: [{ type: "web_search_preview" }], include: ["web_search_call.action.sources"] }
        : {}),
    };
    const response = (await createWithParamFallback(
      (body) => client.responses.create(body as Parameters<typeof client.responses.create>[0]),
      requestBody,
      ["temperature", "include", "tools", "reasoning"],
    )) as { output_text?: string; output?: Array<{ type?: string; action?: { sources?: Array<{ url?: string }> } }> };
    const output = response.output ?? [];
    const sources = options.includeSources
      ? output.flatMap((item) => (item.type === "web_search_call" ? item.action?.sources ?? [] : [])).map((item) => item.url).filter(Boolean) as string[]
      : [];
    return {
      text: response.output_text || "",
      sources,
    };
  }

  // MiniMax reasoning models embed <think> segments in content by default;
  // reasoning_split moves them into reasoning_content so content stays clean JSON.
  const requestBody = {
    model: options.model,
    messages: formatInputForChat(options.input),
    ...(omitTemperature ? {} : { temperature: options.temperature ?? 0 }),
    ...reasoningParams,
    ...(provider === "minimax" ? { reasoning_split: true } : {}),
  };
  const response = await createChatCompletionWithParamFallback(client, requestBody);
  return {
    text: extractTextFromChat(response),
    sources: [],
  };
}
