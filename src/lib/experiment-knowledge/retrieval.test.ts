import test from "node:test";
import assert from "node:assert/strict";
import { retrieveExperimentKnowledge } from "@/lib/experiment-knowledge/retrieval";

test("manual western blot aliases retrieve WB knowledge with high confidence", () => {
  const result = retrieveExperimentKnowledge({
    customExperimentName: "western blot",
    experimentContext: "protein band detection",
  });

  assert.equal(result.candidateCodes[0], "WB");
  assert.ok(result.retrievalConfidence >= 0.82);
  assert.ok(result.requiredTemplateHints.includes("WB 需要裂解/样本制备试剂"));
});

test("elisa retrieval exposes workflow and reagent hints", () => {
  const result = retrieveExperimentKnowledge({
    customExperimentName: "cytokine ELISA assay",
    experimentContext: "secreted IL-6 in conditioned medium",
  });

  assert.equal(result.candidateCodes[0], "ELISA");
  assert.ok(result.workflowHints.includes("包被与封闭"));
  assert.ok(result.requiredTemplateHints.includes("ELISA 需要检测抗体"));
});
