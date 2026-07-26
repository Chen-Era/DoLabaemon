import OpenAI from "openai";
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

// Thinking (reasoning) switches are spelled differently by every provider:
// OpenAI's Responses API takes a reasoning effort, DashScope takes
// enable_thinking, GLM (bigmodel) takes a thinking object, OpenRouter takes
// reasoning.enabled, DeepSeek/Moonshot select thinking purely by model name
// (nothing to send), and MiniMax M1 cannot disable thinking at all — its
// reasoning_split flag (added below) only keeps <think> out of the JSON
// content, so no thinking param is sent regardless of the toggle.
function thinkingParamsForProvider(baseURL: string | null | undefined, thinkingEnabled: boolean): Record<string, unknown> {
  const normalized = normalizeBaseUrl(baseURL);
  const provider = getProvider(baseURL);
  if (provider === "openai") {
    return thinkingEnabled ? { reasoning: { effort: "medium" } } : {};
  }
  if (provider === "minimax") {
    return {};
  }
  if (normalized.includes("dashscope")) {
    return { enable_thinking: thinkingEnabled };
  }
  if (normalized.includes("bigmodel")) {
    return { thinking: { type: thinkingEnabled ? "enabled" : "disabled" } };
  }
  if (normalized.includes("openrouter")) {
    return { reasoning: { enabled: thinkingEnabled } };
  }
  if (normalized.includes("deepseek") || normalized.includes("moonshot")) {
    return {};
  }
  // Self-hosted OpenAI-compatible endpoints (MiMo / vLLM / Ollama / ...)
  // disagree on where the switch lives, so write both the top-level param and
  // the chat-template kwarg; whichever the server rejects gets dropped by the
  // param-fallback retry below.
  return {
    enable_thinking: thinkingEnabled,
    chat_template_kwargs: { enable_thinking: thinkingEnabled },
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

export async function generateLlmText(
  client: ReturnType<typeof getLlmClient>,
  config: (Pick<RuntimeLlmConfig, "baseURL"> & { thinkingEnabled?: boolean }) | undefined,
  options: GenerateTextOptions,
): Promise<GenerateTextResult> {
  const provider = getProvider(config?.baseURL);
  const thinkingEnabled = config?.thinkingEnabled ?? false;
  const thinkingParams = thinkingParamsForProvider(config?.baseURL, thinkingEnabled);

  if (provider === "openai") {
    const requestBody = {
      model: options.model,
      input: formatInputForResponses(options.input),
      temperature: options.temperature ?? 0,
      ...thinkingParams,
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
    temperature: options.temperature ?? 0,
    ...thinkingParams,
    ...(provider === "minimax" ? { reasoning_split: true } : {}),
  };
  const response = await createWithParamFallback(
    (body) => client.chat.completions.create(body as unknown as Parameters<typeof client.chat.completions.create>[0]),
    requestBody,
    ["reasoning_split", "temperature", "enable_thinking", "chat_template_kwargs", "thinking", "reasoning"],
  );
  return {
    text: extractTextFromChat(response),
    sources: [],
  };
}
