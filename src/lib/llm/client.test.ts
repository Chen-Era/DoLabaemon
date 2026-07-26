import test from "node:test";
import assert from "node:assert/strict";
import { generateLlmText, getLlmClient } from "@/lib/llm/client";

test("generateLlmText uses chat completions for minimax-compatible providers", async () => {
  let usedChat = false;
  let usedResponses = false;
  const fakeClient = {
    responses: {
      create: async () => {
        usedResponses = true;
        return { output_text: "RESPONSES" };
      },
    },
    chat: {
      completions: {
        create: async () => {
          usedChat = true;
          return {
            choices: [
              {
                message: {
                  content: "CHAT_OK",
                },
              },
            ],
          };
        },
      },
    },
  };

  const result = await generateLlmText(fakeClient as never, { baseURL: "https://api.minimaxi.com/v1" }, {
    model: "MiniMax-M2.7",
    input: [{ role: "user", content: "Say OK" }],
    temperature: 0,
  });

  assert.equal(result.text, "CHAT_OK");
  assert.equal(usedChat, true);
  assert.equal(usedResponses, false);
});

test("getLlmClient normalizes quoted base urls", () => {
  const client = getLlmClient({
    apiKey: "test-key",
    baseURL: " `https://api-inference.modelscope.cn/v1` ",
  }) as unknown as { baseURL?: string };

  assert.equal(client.baseURL, "https://api-inference.modelscope.cn/v1");
});

test("generateLlmText retries without temperature when the provider rejects it", async () => {
  const seenBodies: Array<Record<string, unknown>> = [];
  const fakeClient = {
    chat: {
      completions: {
        create: async (body: Record<string, unknown>) => {
          seenBodies.push({ ...body });
          if ("temperature" in body) {
            const error = new Error("400 temperature must be in (0, 1]");
            throw error;
          }
          return { choices: [{ message: { content: "OK_AFTER_RETRY" } }] };
        },
      },
    },
  };

  const result = await generateLlmText(fakeClient as never, { baseURL: "https://mimo.example.com/v1" }, {
    model: "mimo-v1",
    input: [{ role: "user", content: "Say OK" }],
    temperature: 0,
  });

  assert.equal(result.text, "OK_AFTER_RETRY");
  assert.equal(seenBodies.length, 2);
  assert.equal("temperature" in seenBodies[0], true);
  assert.equal("temperature" in seenBodies[1], false);
});

test("generateLlmText retries without reasoning_split when minimax rejects it", async () => {
  const seenBodies: Array<Record<string, unknown>> = [];
  const fakeClient = {
    chat: {
      completions: {
        create: async (body: Record<string, unknown>) => {
          seenBodies.push({ ...body });
          if ("reasoning_split" in body) {
            throw new Error("400 unknown field reasoning_split");
          }
          return { choices: [{ message: { content: "OK_NO_SPLIT" } }] };
        },
      },
    },
  };

  const result = await generateLlmText(fakeClient as never, { baseURL: "https://api.minimaxi.com/v1" }, {
    model: "MiniMax-M1-80k",
    input: [{ role: "user", content: "Say OK" }],
    temperature: 0,
  });

  assert.equal(result.text, "OK_NO_SPLIT");
  assert.equal(seenBodies.length, 2);
  assert.equal("reasoning_split" in seenBodies[1], false);
  assert.equal("temperature" in seenBodies[1], true);
});

test("generateLlmText surfaces errors that name no droppable parameter", async () => {
  const fakeClient = {
    chat: {
      completions: {
        create: async () => {
          throw new Error("401 invalid api key");
        },
      },
    },
  };

  await assert.rejects(
    generateLlmText(fakeClient as never, { baseURL: "https://mimo.example.com/v1" }, {
      model: "mimo-v1",
      input: [{ role: "user", content: "Say OK" }],
      temperature: 0,
    }),
    /invalid api key/,
  );
});

test("generateLlmText declares the web search tool when sources are requested", async () => {
  const seen: { body?: Record<string, unknown> } = {};
  const fakeClient = {
    responses: {
      create: async (body: Record<string, unknown>) => {
        seen.body = body;
        return {
          output_text: "VERIFIED",
          output: [
            { type: "web_search_call", action: { sources: [{ url: "https://example.com/product" }] } },
          ],
        };
      },
    },
  };

  const result = await generateLlmText(fakeClient as never, { baseURL: "https://api.openai.com/v1" }, {
    model: "gpt-4.1-mini",
    input: [{ role: "user", content: "verify" }],
    temperature: 0,
    includeSources: true,
  });

  assert.equal(result.text, "VERIFIED");
  assert.deepEqual(result.sources, ["https://example.com/product"]);
  assert.ok(Array.isArray(seen.body?.tools));
  assert.equal((seen.body?.tools as Array<{ type: string }>)[0]?.type, "web_search_preview");
  assert.deepEqual(seen.body?.include, ["web_search_call.action.sources"]);
});

test("generateLlmText sends enable_thinking and chat_template_kwargs for custom providers", async () => {
  const seen: { body?: Record<string, unknown> } = {};
  const fakeClient = {
    chat: {
      completions: {
        create: async (body: Record<string, unknown>) => {
          seen.body = body;
          return { choices: [{ message: { content: "OK_CUSTOM" } }] };
        },
      },
    },
  };

  const result = await generateLlmText(fakeClient as never, { baseURL: "https://mimo.example.com/v1", thinkingEnabled: false }, {
    model: "mimo-v1",
    input: [{ role: "user", content: "Say OK" }],
    temperature: 0,
  });

  assert.equal(result.text, "OK_CUSTOM");
  assert.equal(seen.body?.enable_thinking, false);
  assert.deepEqual(seen.body?.chat_template_kwargs, { enable_thinking: false });
});

test("generateLlmText maps the thinking toggle to enable_thinking for dashscope", async () => {
  const seen: { body?: Record<string, unknown> } = {};
  const fakeClient = {
    chat: {
      completions: {
        create: async (body: Record<string, unknown>) => {
          seen.body = body;
          return { choices: [{ message: { content: "OK_DASHSCOPE" } }] };
        },
      },
    },
  };

  const result = await generateLlmText(
    fakeClient as never,
    { baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1", thinkingEnabled: true },
    {
      model: "qwen-plus",
      input: [{ role: "user", content: "Say OK" }],
      temperature: 0,
    },
  );

  assert.equal(result.text, "OK_DASHSCOPE");
  assert.equal(seen.body?.enable_thinking, true);
  assert.equal("chat_template_kwargs" in (seen.body ?? {}), false);
  assert.equal("reasoning" in (seen.body ?? {}), false);
});

test("generateLlmText adds no reasoning param for OpenAI when thinking is off", async () => {
  const seen: { body?: Record<string, unknown> } = {};
  const fakeClient = {
    responses: {
      create: async (body: Record<string, unknown>) => {
        seen.body = body;
        return { output_text: "OK_OPENAI" };
      },
    },
  };

  const result = await generateLlmText(fakeClient as never, { baseURL: "https://api.openai.com/v1", thinkingEnabled: false }, {
    model: "gpt-4.1-mini",
    input: [{ role: "user", content: "Say OK" }],
    temperature: 0,
  });

  assert.equal(result.text, "OK_OPENAI");
  assert.equal("reasoning" in (seen.body ?? {}), false);
});

test("generateLlmText adds medium reasoning effort for OpenAI when thinking is on", async () => {
  const seen: { body?: Record<string, unknown> } = {};
  const fakeClient = {
    responses: {
      create: async (body: Record<string, unknown>) => {
        seen.body = body;
        return { output_text: "OK_OPENAI_THINKING" };
      },
    },
  };

  const result = await generateLlmText(fakeClient as never, { baseURL: "https://api.openai.com/v1", thinkingEnabled: true }, {
    model: "gpt-4.1-mini",
    input: [{ role: "user", content: "Say OK" }],
    temperature: 0,
  });

  assert.equal(result.text, "OK_OPENAI_THINKING");
  assert.deepEqual(seen.body?.reasoning, { effort: "medium" });
});

test("generateLlmText drops enable_thinking and retries when the server names it", async () => {
  const seenBodies: Array<Record<string, unknown>> = [];
  const fakeClient = {
    chat: {
      completions: {
        create: async (body: Record<string, unknown>) => {
          seenBodies.push({ ...body });
          if ("enable_thinking" in body) {
            throw new Error("400 unknown field enable_thinking");
          }
          return { choices: [{ message: { content: "OK_NO_THINKING" } }] };
        },
      },
    },
  };

  const result = await generateLlmText(fakeClient as never, { baseURL: "https://mimo.example.com/v1", thinkingEnabled: true }, {
    model: "mimo-v1",
    input: [{ role: "user", content: "Say OK" }],
    temperature: 0,
  });

  assert.equal(result.text, "OK_NO_THINKING");
  assert.equal(seenBodies.length, 2);
  assert.equal(seenBodies[0].enable_thinking, true);
  assert.equal("enable_thinking" in seenBodies[1], false);
  // Only the named param is dropped; the chat-template kwarg survives the retry.
  assert.deepEqual(seenBodies[1].chat_template_kwargs, { enable_thinking: true });
});
