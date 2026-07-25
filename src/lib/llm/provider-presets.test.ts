import test from "node:test";
import assert from "node:assert/strict";
import { llmProviderPresets, matchProviderPreset } from "@/lib/llm/provider-presets";

test("provider presets have unique ids and valid https base urls", () => {
  const ids = llmProviderPresets.map((preset) => preset.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const preset of llmProviderPresets) {
    assert.ok(preset.baseUrl.startsWith("https://"), `${preset.id} must use https`);
    assert.ok(preset.label.length > 0);
  }
});

test("matchProviderPreset matches exact urls ignoring case and trailing slash", () => {
  assert.equal(matchProviderPreset("https://api.minimaxi.com/v1")?.id, "minimax");
  assert.equal(matchProviderPreset("HTTPS://API.MINIMAXI.COM/v1/")?.id, "minimax");
  assert.equal(matchProviderPreset(" https://api.deepseek.com/v1 ")?.id, "deepseek");
});

test("matchProviderPreset falls back to host matching and returns null for custom", () => {
  assert.equal(matchProviderPreset("https://api.openai.com/v1/")?.id, "openai");
  assert.equal(matchProviderPreset("https://example.com/v1"), null);
  assert.equal(matchProviderPreset(""), null);
  assert.equal(matchProviderPreset(null), null);
});
