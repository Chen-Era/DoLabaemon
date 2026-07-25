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
  config: Pick<RuntimeLlmConfig, "baseURL"> | undefined,
  options: GenerateTextOptions,
): Promise<GenerateTextResult> {
  const provider = getProvider(config?.baseURL);

  if (provider === "openai") {
    const response = await client.responses.create({
      model: options.model,
      input: formatInputForResponses(options.input),
      temperature: options.temperature ?? 0,
      include: options.includeSources ? ["web_search_call.action.sources"] : undefined,
    });
    const output = (response as { output?: Array<{ type?: string; action?: { sources?: Array<{ url?: string }> } }> }).output ?? [];
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
    ...(provider === "minimax" ? { reasoning_split: true } : {}),
  } as Parameters<typeof client.chat.completions.create>[0];
  const response = await client.chat.completions.create(requestBody);
  return {
    text: extractTextFromChat(response),
    sources: [],
  };
}
