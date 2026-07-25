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
