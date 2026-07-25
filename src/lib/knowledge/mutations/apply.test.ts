import test from "node:test";
import assert from "node:assert/strict";
import { retrieveExperimentKnowledgeRuntime } from "@/lib/experiment-knowledge/runtime";
import { applyKnowledgeMutation } from "@/lib/knowledge/mutations/apply";
import { retrieveReagentKnowledgeRuntime } from "@/lib/reagent-knowledge/runtime";

async function withEnv<T>(env: Record<string, string | undefined>, run: () => Promise<T>) {
  const previous = Object.fromEntries(Object.keys(env).map((key) => [key, process.env[key]]));
  Object.entries(env).forEach(([key, value]) => {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  });
  try {
    return await run();
  } finally {
    Object.entries(previous).forEach(([key, value]) => {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    });
  }
}

test("applyKnowledgeMutation writes learned reagent knowledge that runtime retrieval can reuse", async () => {
  await withEnv({ DEMO_MODE: "true" }, async () => {
    const name = "Learned OsteoFactor X";
    const applied = await applyKnowledgeMutation({
      labId: "demo-lab",
      userId: "demo-user",
      flowType: "reagent-parse",
      domain: "REAGENT",
      entityKey: `${name}::OFX-001`,
      afterData: {
        category: "BIOLOGICAL",
        subCategory: "Recombinant Growth Factor",
        experimentTags: ["CELL_STIMULATION_REAGENT", "OSTEOGENIC_DIFFERENTIATION_REAGENT"],
        confidence: 0.91,
        warnings: ["learned entry"],
      },
      evidenceSummary: ["manual verification"],
      modelName: "test-model",
      selfCheckOk: true,
    });

    assert.equal(applied.status, "APPLIED");

    const retrieved = await retrieveReagentKnowledgeRuntime({
      name,
      catalogNo: "OFX-001",
      note: "",
    });
    assert.equal(retrieved.candidateCategories[0], "BIOLOGICAL");
    assert.ok(retrieved.candidateSubCategories.includes("Recombinant Growth Factor"));
  });
});

test("applyKnowledgeMutation writes learned experiment knowledge that runtime retrieval can reuse", async () => {
  await withEnv({ DEMO_MODE: "true" }, async () => {
    const applied = await applyKnowledgeMutation({
      labId: "demo-lab",
      userId: "demo-user",
      flowType: "experiment-resolve",
      domain: "EXPERIMENT",
      entityKey: "Secreted Osteokine Panel Assay",
      afterData: {
        proposedExperimentName: "Secreted Osteokine Panel Assay",
        proposedExperimentCode: "OSTEOKINE_PANEL",
        matchedExistingCode: null,
        workflowStages: ["样本准备", "上清检测"],
        minRequiredItems: [{ name: "检测抗体", matcherType: "NAME_ANY", matcherValues: ["detection antibody"] }],
        recommendedItems: [{ name: "刺激试剂", matcherType: "TAG_ANY", matcherValues: ["CELL_STIMULATION_REAGENT"] }],
        rationale: "learned experiment",
      },
      evidenceSummary: ["manual verification"],
      modelName: "test-model",
      selfCheckOk: true,
    });

    assert.equal(applied.status, "APPLIED");

    const retrieved = await retrieveExperimentKnowledgeRuntime({
      customExperimentName: "Secreted Osteokine Panel Assay",
      experimentContext: "上清检测",
    });
    assert.equal(retrieved.candidateCodes[0], "OSTEOKINE_PANEL");
    assert.ok(retrieved.workflowHints.includes("样本准备"));
  });
});
