import test from "node:test";
import assert from "node:assert/strict";
import { cleanUrlText } from "@/lib/url/clean-url";

test("cleanUrlText trims whitespace and unwraps quoted urls", () => {
  assert.equal(cleanUrlText(" `https://api-inference.modelscope.cn/v1` "), "https://api-inference.modelscope.cn/v1");
  assert.equal(cleanUrlText(" 'https://example.com/api' "), "https://example.com/api");
  assert.equal(cleanUrlText(" \"https://example.com/v1\" "), "https://example.com/v1");
});

test("cleanUrlText keeps plain urls and empties blank input", () => {
  assert.equal(cleanUrlText("https://example.com/v1"), "https://example.com/v1");
  assert.equal(cleanUrlText("   "), null);
  assert.equal(cleanUrlText(undefined), null);
});
