import test from "node:test";
import assert from "node:assert/strict";
import { retrieveReagentKnowledge } from "@/lib/reagent-knowledge/retrieval";

test("retrieveReagentKnowledge recalls recombinant ligand protein candidates", () => {
  const result = retrieveReagentKnowledge({
    name: "Soluble RANK Ligand (sRANKL) Protein, Recombinant human",
    catalogNo: "debug-cat",
    note: "bone biology",
  });

  assert.equal(result.candidateCategories[0], "BIOLOGICAL");
  assert.ok(result.candidateSubCategories.includes("Recombinant Protein"));
  assert.ok(result.candidateExperimentTags.includes("CELL_STIMULATION_REAGENT"));
  assert.ok(result.candidateExperimentTags.includes("SIGNALING_MODULATOR"));
  assert.ok(result.candidateExperimentTags.includes("OSTEOCLAST_DIFFERENTIATION_REAGENT"));
  assert.ok(result.candidateExperimentTags.includes("BONE_REMODELING_SIGNAL"));
  assert.ok(result.evidenceLines.some((line) => line.includes("RANKL")));
});

test("retrieveReagentKnowledge blocks excluded structural families", () => {
  const result = retrieveReagentKnowledge({
    name: "RANKL antibody",
    catalogNo: "debug-cat",
    note: "",
  });

  assert.equal(result.matchedEntries.length, 0);
});

test("retrieveReagentKnowledge recalls pathway inhibitors and gene perturbation families", () => {
  const inhibitor = retrieveReagentKnowledge({
    name: "DAPT gamma-secretase inhibitor",
    catalogNo: "debug-cat",
    note: "",
  });
  const sirna = retrieveReagentKnowledge({
    name: "LC3B siRNA smartpool",
    catalogNo: "debug-cat",
    note: "",
  });

  assert.equal(inhibitor.candidateCategories[0], "CHEMICAL");
  assert.ok(inhibitor.candidateSubCategories.includes("Pathway Inhibitor"));
  assert.ok(inhibitor.candidateExperimentTags.includes("SIGNALING_MODULATOR"));

  assert.equal(sirna.candidateCategories[0], "BIOLOGICAL");
  assert.ok(sirna.candidateSubCategories.includes("siRNA"));
  assert.ok(sirna.candidateExperimentTags.includes("GENE_DELIVERY_REAGENT"));
});

test("retrieveReagentKnowledge recalls finer cytokine and matrix semantics", () => {
  const il6 = retrieveReagentKnowledge({
    name: "Recombinant human IL-6 protein",
    catalogNo: "debug-cat",
    note: "",
  });
  const bmp2 = retrieveReagentKnowledge({
    name: "BMP2 recombinant protein",
    catalogNo: "debug-cat",
    note: "",
  });
  const matrigel = retrieveReagentKnowledge({
    name: "Growth factor reduced Matrigel matrix",
    catalogNo: "debug-cat",
    note: "",
  });

  assert.ok(il6.candidateExperimentTags.includes("IMMUNE_CYTOKINE_REAGENT"));
  assert.ok(bmp2.candidateExperimentTags.includes("OSTEOGENIC_DIFFERENTIATION_REAGENT"));
  assert.ok(bmp2.candidateExperimentTags.includes("BONE_REMODELING_SIGNAL"));
  assert.ok(matrigel.candidateExperimentTags.includes("ECM_COATING_REAGENT"));
  assert.ok(matrigel.candidateExperimentTags.includes("STEM_CELL_MATRIX"));
});
