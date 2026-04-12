import test from "node:test";
import assert from "node:assert/strict";
import { resolveExperimentInput } from "@/lib/experiment/resolve";

test("manual alias resolves directly to WB", async () => {
  const result = await resolveExperimentInput({
    customExperimentName: "免疫印迹",
    lang: "zh",
  });

  assert.equal(result.resolvedExperimentType, "WB");
  assert.equal(result.needsConfirmation, false);
});

test("manual ELISA name resolves to formal ELISA type", async () => {
  const result = await resolveExperimentInput({
    customExperimentName: "ELISA",
    experimentContext: "measure secreted IL-6",
    lang: "zh",
  });

  assert.equal(result.resolvedExperimentType, "ELISA");
  assert.equal(result.needsConfirmation, false);
});

test("low-confidence manual experiment returns suggestion and requires confirmation", async () => {
  const result = await resolveExperimentInput({
    customExperimentName: "conditioned medium cytokine secretion assay",
    experimentContext: "measure secreted factors in supernatant",
    lang: "zh",
  });

  assert.equal(result.needsConfirmation, true);
  assert.equal(result.resolutionSource, "MODEL_SUGGESTION");
  assert.ok(result.suggestion);
});
