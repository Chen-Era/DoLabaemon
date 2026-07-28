import test from "node:test";
import assert from "node:assert/strict";
import { buildReagentParsePrompt } from "@/lib/llm/prompts/reagent-parse";
import { buildReagentVerifyPrompt } from "@/lib/llm/prompts/reagent-verify";

test("reagent parse prompt requires a primary-antibody tag and protects secondary antibodies", () => {
  const prompt = buildReagentParsePrompt("en");

  assert.match(prompt, /PRIMARY.*WB_PRIMARY_ANTIBODY/i);
  assert.match(prompt, /SECONDARY.*Never add a PRIMARY antibody tag/i);
});

test("reagent verification prompt preserves supported draft tags", () => {
  const prompt = buildReagentVerifyPrompt({
    lang: "en",
    verificationMethod: "external_search",
    initialDraft: { category: "ANTIBODY", experimentTags: ["WB_PRIMARY_ANTIBODY"] },
  });

  assert.match(prompt, /preserve them and append supported tags/i);
  assert.match(prompt, /PRIMARY.*WB_PRIMARY_ANTIBODY/i);
});
