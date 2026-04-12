import test from "node:test";
import assert from "node:assert/strict";
import { getProviderLabel, supportsNativeWebSearch } from "@/lib/llm/model-capabilities";

test("getProviderLabel recognizes openai minimax and custom providers", () => {
  assert.equal(getProviderLabel(undefined), "openai");
  assert.equal(getProviderLabel("https://api.openai.com/v1"), "openai");
  assert.equal(getProviderLabel("https://api.minimaxi.com/v1"), "minimax");
  assert.equal(getProviderLabel("https://example.com/v1"), "custom");
});

test("supportsNativeWebSearch is conservative for non-openai providers", () => {
  assert.equal(supportsNativeWebSearch({ baseUrl: "https://api.openai.com/v1", model: "gpt-5-mini" }), true);
  assert.equal(supportsNativeWebSearch({ baseUrl: "https://api.minimaxi.com/v1", model: "MiniMax-M1-80k" }), false);
  assert.equal(supportsNativeWebSearch({ baseUrl: "https://example.com/v1", model: "gpt-like" }), false);
});
