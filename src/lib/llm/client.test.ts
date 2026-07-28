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

  const result = await generateLlmText(fakeClient as never, { baseURL: "https://mimo.example.com/v1", reasoningEffort: "off" }, {
    model: "mimo-v1",
    input: [{ role: "user", content: "Say OK" }],
    temperature: 0,
  });

  assert.equal(result.text, "OK_CUSTOM");
  assert.equal(seen.body?.enable_thinking, false);
  assert.deepEqual(seen.body?.chat_template_kwargs, { enable_thinking: false });
});

test("generateLlmText enables enable_thinking for custom providers at any level above off", async () => {
  const seen: { body?: Record<string, unknown> } = {};
  const fakeClient = {
    chat: {
      completions: {
        create: async (body: Record<string, unknown>) => {
          seen.body = body;
          return { choices: [{ message: { content: "OK_CUSTOM_LOW" } }] };
        },
      },
    },
  };

  const result = await generateLlmText(fakeClient as never, { baseURL: "https://mimo.example.com/v1", reasoningEffort: "low" }, {
    model: "mimo-v1",
    input: [{ role: "user", content: "Say OK" }],
    temperature: 0,
  });

  assert.equal(result.text, "OK_CUSTOM_LOW");
  assert.equal(seen.body?.enable_thinking, true);
  assert.deepEqual(seen.body?.chat_template_kwargs, { enable_thinking: true });
});

test("generateLlmText uses MiMo V2.5's binary thinking controls without unsupported effort fields", async () => {
  const seenBodies: Array<Record<string, unknown>> = [];
  const fakeClient = {
    chat: {
      completions: {
        create: async (body: Record<string, unknown>) => {
          seenBodies.push({ ...body });
          return { choices: [{ message: { content: "OK_MIMO" } }] };
        },
      },
    },
  };

  await generateLlmText(fakeClient as never, { baseURL: "https://api.xiaomimimo.com/v1", reasoningEffort: "high" }, {
    model: "mimo-v2.5-pro",
    input: [{ role: "user", content: "Say OK" }],
  });
  await generateLlmText(fakeClient as never, { baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1", reasoningEffort: "off" }, {
    model: "xiaomi/mimo-v2.5-pro",
    input: [{ role: "user", content: "Say OK" }],
  });

  assert.deepEqual(seenBodies[0].thinking, { type: "enabled" });
  assert.equal("temperature" in seenBodies[0], false);
  assert.equal("reasoning_effort" in seenBodies[0], false);
  assert.equal("thinking_budget" in seenBodies[0], false);
  assert.equal(seenBodies[1].enable_thinking, false);
  assert.equal("thinking_budget" in seenBodies[1], false);
});

test("generateLlmText maps the selected level to DeepSeek V4 thinking controls", async () => {
  const seenBodies: Array<Record<string, unknown>> = [];
  const fakeClient = {
    chat: {
      completions: {
        create: async (body: Record<string, unknown>) => {
          seenBodies.push({ ...body });
          return { choices: [{ message: { content: "OK_DEEPSEEK" } }] };
        },
      },
    },
  };

  await generateLlmText(fakeClient as never, { baseURL: "https://api.deepseek.com/v1", reasoningEffort: "low" }, {
    model: "deepseek-v4-flash",
    input: [{ role: "user", content: "Say OK" }],
  });
  await generateLlmText(fakeClient as never, { baseURL: "https://api.deepseek.com/v1", reasoningEffort: "off" }, {
    model: "deepseek-v4-flash",
    input: [{ role: "user", content: "Say OK" }],
  });

  assert.deepEqual(seenBodies[0].thinking, { type: "enabled" });
  assert.equal(seenBodies[0].reasoning_effort, "high");
  assert.deepEqual(seenBodies[1].thinking, { type: "disabled" });
  assert.equal("reasoning_effort" in seenBodies[1], false);
});

test("generateLlmText supports Kimi's configurable and always-on reasoning models", async () => {
  const seenBodies: Array<Record<string, unknown>> = [];
  const fakeClient = {
    chat: {
      completions: {
        create: async (body: Record<string, unknown>) => {
          seenBodies.push({ ...body });
          return { choices: [{ message: { content: "OK_KIMI" } }] };
        },
      },
    },
  };

  await generateLlmText(fakeClient as never, { baseURL: "https://api.moonshot.cn/v1", reasoningEffort: "off" }, {
    model: "kimi-k2.6",
    input: [{ role: "user", content: "Say OK" }],
  });
  await generateLlmText(fakeClient as never, { baseURL: "https://api.moonshot.cn/v1", reasoningEffort: "medium" }, {
    model: "kimi-k3",
    input: [{ role: "user", content: "Say OK" }],
  });
  await generateLlmText(fakeClient as never, { baseURL: "https://api.moonshot.cn/v1", reasoningEffort: "off" }, {
    model: "kimi-k2.7-code",
    input: [{ role: "user", content: "Say OK" }],
  });

  assert.deepEqual(seenBodies[0].thinking, { type: "disabled" });
  assert.equal("temperature" in seenBodies[0], false);
  assert.equal(seenBodies[1].reasoning_effort, "high");
  assert.equal("thinking" in seenBodies[1], false);
  assert.equal("thinking" in seenBodies[2], false);
  assert.equal("reasoning_effort" in seenBodies[2], false);
  assert.equal("temperature" in seenBodies[2], false);
});

test("generateLlmText maps reasoning levels to enable_thinking and thinking_budget for dashscope", async () => {
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
    { baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1", reasoningEffort: "medium" },
    {
      model: "qwen-plus",
      input: [{ role: "user", content: "Say OK" }],
      temperature: 0,
    },
  );

  assert.equal(result.text, "OK_DASHSCOPE");
  assert.equal(seen.body?.enable_thinking, true);
  assert.equal(seen.body?.thinking_budget, 8192);
  assert.equal("chat_template_kwargs" in (seen.body ?? {}), false);
  assert.equal("reasoning" in (seen.body ?? {}), false);
});

test("generateLlmText disables thinking without a budget for dashscope at off", async () => {
  const seen: { body?: Record<string, unknown> } = {};
  const fakeClient = {
    chat: {
      completions: {
        create: async (body: Record<string, unknown>) => {
          seen.body = body;
          return { choices: [{ message: { content: "OK_DASHSCOPE_OFF" } }] };
        },
      },
    },
  };

  const result = await generateLlmText(
    fakeClient as never,
    { baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1", reasoningEffort: "off" },
    {
      model: "qwen-plus",
      input: [{ role: "user", content: "Say OK" }],
      temperature: 0,
    },
  );

  assert.equal(result.text, "OK_DASHSCOPE_OFF");
  assert.equal(seen.body?.enable_thinking, false);
  assert.equal("thinking_budget" in (seen.body ?? {}), false);
});

test("generateLlmText adds no reasoning param for OpenAI at off", async () => {
  const seen: { body?: Record<string, unknown> } = {};
  const fakeClient = {
    responses: {
      create: async (body: Record<string, unknown>) => {
        seen.body = body;
        return { output_text: "OK_OPENAI" };
      },
    },
  };

  const result = await generateLlmText(fakeClient as never, { baseURL: "https://api.openai.com/v1", reasoningEffort: "off" }, {
    model: "gpt-4.1-mini",
    input: [{ role: "user", content: "Say OK" }],
    temperature: 0,
  });

  assert.equal(result.text, "OK_OPENAI");
  assert.equal("reasoning" in (seen.body ?? {}), false);
});

test("generateLlmText passes the selected reasoning effort through for OpenAI", async () => {
  const seen: { body?: Record<string, unknown> } = {};
  const fakeClient = {
    responses: {
      create: async (body: Record<string, unknown>) => {
        seen.body = body;
        return { output_text: "OK_OPENAI_THINKING" };
      },
    },
  };

  const result = await generateLlmText(fakeClient as never, { baseURL: "https://api.openai.com/v1", reasoningEffort: "high" }, {
    model: "gpt-4.1-mini",
    input: [{ role: "user", content: "Say OK" }],
    temperature: 0,
  });

  assert.equal(result.text, "OK_OPENAI_THINKING");
  assert.deepEqual(seen.body?.reasoning, { effort: "high" });
});

test("generateLlmText maps reasoning levels to reasoning.enabled plus effort for openrouter", async () => {
  const seenBodies: Array<Record<string, unknown>> = [];
  const fakeClient = {
    chat: {
      completions: {
        create: async (body: Record<string, unknown>) => {
          seenBodies.push({ ...body });
          return { choices: [{ message: { content: "OK_OPENROUTER" } }] };
        },
      },
    },
  };

  await generateLlmText(fakeClient as never, { baseURL: "https://openrouter.ai/api/v1", reasoningEffort: "low" }, {
    model: "openai/gpt-4.1-mini",
    input: [{ role: "user", content: "Say OK" }],
    temperature: 0,
  });
  await generateLlmText(fakeClient as never, { baseURL: "https://openrouter.ai/api/v1", reasoningEffort: "off" }, {
    model: "openai/gpt-4.1-mini",
    input: [{ role: "user", content: "Say OK" }],
    temperature: 0,
  });

  assert.deepEqual(seenBodies[0].reasoning, { enabled: true, effort: "low" });
  assert.deepEqual(seenBodies[1].reasoning, { enabled: false });
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

  const result = await generateLlmText(fakeClient as never, { baseURL: "https://mimo.example.com/v1", reasoningEffort: "medium" }, {
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

test("generateLlmText drops the chat-template wrapper when its nested thinking field is rejected", async () => {
  const seenBodies: Array<Record<string, unknown>> = [];
  const fakeClient = {
    chat: {
      completions: {
        create: async (body: Record<string, unknown>) => {
          seenBodies.push({ ...body });
          if ("enable_thinking" in body || "chat_template_kwargs" in body) {
            throw new Error("400 unsupported enable_thinking");
          }
          return { choices: [{ message: { content: "OK_NO_TEMPLATE" } }] };
        },
      },
    },
  };

  const result = await generateLlmText(fakeClient as never, { baseURL: "https://mimo.example.com/v1", reasoningEffort: "medium" }, {
    model: "mimo-v1",
    input: [{ role: "user", content: "Say OK" }],
  });

  assert.equal(result.text, "OK_NO_TEMPLATE");
  assert.equal(seenBodies.length, 3);
  assert.equal("enable_thinking" in seenBodies[1], false);
  assert.equal("chat_template_kwargs" in seenBodies[2], false);
});

test("generateLlmText drops thinking_budget and retries when the server names it", async () => {
  const seenBodies: Array<Record<string, unknown>> = [];
  const fakeClient = {
    chat: {
      completions: {
        create: async (body: Record<string, unknown>) => {
          seenBodies.push({ ...body });
          if ("thinking_budget" in body) {
            throw new Error("400 thinking_budget must be between 0 and 4096");
          }
          return { choices: [{ message: { content: "OK_NO_BUDGET" } }] };
        },
      },
    },
  };

  const result = await generateLlmText(
    fakeClient as never,
    { baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1", reasoningEffort: "high" },
    {
      model: "qwen-plus",
      input: [{ role: "user", content: "Say OK" }],
      temperature: 0,
    },
  );

  assert.equal(result.text, "OK_NO_BUDGET");
  assert.equal(seenBodies.length, 2);
  assert.equal(seenBodies[0].thinking_budget, 32768);
  assert.equal("thinking_budget" in seenBodies[1], false);
  // 预算被丢弃后开关本身仍保留，推理按平台默认强度进行。
  assert.equal(seenBodies[1].enable_thinking, true);
});
