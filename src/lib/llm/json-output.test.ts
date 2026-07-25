import test from "node:test";
import assert from "node:assert/strict";
import { parseLlmJson } from "@/lib/llm/json-output";

test("parseLlmJson parses a plain JSON object", () => {
  assert.deepEqual(parseLlmJson('{"category":"ANTIBODY","confidence":0.9}'), {
    category: "ANTIBODY",
    confidence: 0.9,
  });
});

test("parseLlmJson parses a plain JSON array", () => {
  assert.deepEqual(parseLlmJson('[{"name":"DMEM"}]'), [{ name: "DMEM" }]);
});

test("parseLlmJson strips markdown code fences", () => {
  const raw = '```json\n{"category":"KIT","vendor":"Thermo"}\n```';
  assert.deepEqual(parseLlmJson(raw), { category: "KIT", vendor: "Thermo" });
});

test("parseLlmJson strips code fences without a language tag", () => {
  const raw = '```\n[{"name":"FBS"}]\n```';
  assert.deepEqual(parseLlmJson(raw), [{ name: "FBS" }]);
});

test("parseLlmJson strips reasoning think blocks before the answer", () => {
  const raw = '<think>Let me analyze this reagent. {"draft": true} It looks like an antibody.</think>\n{"category":"ANTIBODY","confidence":0.8}';
  assert.deepEqual(parseLlmJson(raw), { category: "ANTIBODY", confidence: 0.8 });
});

test("parseLlmJson strips think blocks wrapping a fenced answer", () => {
  const raw = '<think>reasoning here</think>\n```json\n{"category":"PRIMER"}\n```';
  assert.deepEqual(parseLlmJson(raw), { category: "PRIMER" });
});

test("parseLlmJson throws when an unterminated think block swallows the answer", () => {
  const raw = '{"category":"BUFFER"}';
  assert.deepEqual(parseLlmJson(raw), { category: "BUFFER" });
  assert.throws(() => parseLlmJson('<think>never closed {"category":"BUFFER"}'), /LLM_OUTPUT_NOT_JSON/);
});

test("parseLlmJson extracts JSON surrounded by prose", () => {
  const raw = '好的，解析结果如下：\n{"category":"BIOLOGICAL","subCategory":"Recombinant Protein"}\n希望对你有帮助。';
  assert.deepEqual(parseLlmJson(raw), { category: "BIOLOGICAL", subCategory: "Recombinant Protein" });
});

test("parseLlmJson keeps braces inside string values intact", () => {
  const raw = '结果：{"note":"use {this} carefully","nested":{"a":[1,2,{"b":"x\\"}y"}]}} 完毕';
  assert.deepEqual(parseLlmJson(raw), {
    note: "use {this} carefully",
    nested: { a: [1, 2, { b: 'x"}y' }] },
  });
});

test("parseLlmJson tolerates trailing commas", () => {
  const raw = '{"category":"CHEMICAL","tags":["A","B",],}';
  assert.deepEqual(parseLlmJson(raw), { category: "CHEMICAL", tags: ["A", "B"] });
});

test("parseLlmJson tolerates a BOM prefix", () => {
  assert.deepEqual(parseLlmJson('\uFEFF{"category":"OTHER"}'), { category: "OTHER" });
});

test("parseLlmJson throws a descriptive error for non-JSON output", () => {
  assert.throws(() => parseLlmJson("I cannot parse this reagent."), /LLM_OUTPUT_NOT_JSON/);
  assert.throws(() => parseLlmJson(""), /LLM_OUTPUT_NOT_JSON/);
});
