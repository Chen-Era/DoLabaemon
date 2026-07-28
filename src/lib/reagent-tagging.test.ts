import assert from "node:assert/strict";
import test from "node:test";
import { detectAntibodyMeta, enrichParsedReagentResult } from "@/lib/reagent-tagging";

function llmDraft(overrides: Partial<Parameters<typeof enrichParsedReagentResult>[1]> = {}) {
  return {
    category: "OTHER" as const,
    confidence: 0.8,
    warnings: [],
    experimentTags: [],
    antibodyMeta: null,
    primerMeta: null,
    ...overrides,
  };
}

test("enrichment fills missing primary antibody metadata and WB tag from product names", () => {
  const klf6 = enrichParsedReagentResult(
    { name: "KLF6 Polyclonal antibody", catalogNo: "14716-1-AP" },
    llmDraft({ category: "ANTIBODY" }),
  );
  const phosphoAmpk = enrichParsedReagentResult(
    { name: "Phospho-AMPK alpha (Thr172) Rabbit mAb", catalogNo: "2535T" },
    llmDraft({ category: "ANTIBODY" }),
  );

  assert.equal(klf6.antibodyMeta?.role, "PRIMARY");
  assert.ok(klf6.experimentTags.includes("WB_PRIMARY_ANTIBODY"));
  assert.equal(phosphoAmpk.antibodyMeta?.role, "PRIMARY");
  assert.ok(phosphoAmpk.experimentTags.includes("WB_PRIMARY_ANTIBODY"));
});

test("antibody recognition distinguishes anti-species secondaries from target antibodies", () => {
  const secondary = enrichParsedReagentResult(
    { name: "Goat anti-rabbit IgG HRP secondary antibody", catalogNo: "A-11034" },
    llmDraft({ category: "ANTIBODY", experimentTags: ["WB_PRIMARY_ANTIBODY"] }),
  );
  const targetAntibody = detectAntibodyMeta("Rabbit anti-mouse TNF antibody");

  assert.equal(secondary.antibodyMeta?.role, "SECONDARY");
  assert.equal(secondary.antibodyMeta?.hostSpecies, "Goat");
  assert.equal(secondary.antibodyMeta?.targetSpecies, "rabbit");
  assert.ok(!secondary.experimentTags.includes("WB_PRIMARY_ANTIBODY"));
  assert.ok(secondary.experimentTags.includes("WB_SECONDARY_ANTIBODY"));
  assert.equal(targetAntibody?.role, "PRIMARY");
  assert.equal(targetAntibody?.hostSpecies, "Rabbit");
});

test("ambiguous conjugates and controls do not acquire a WB primary-antibody tag", () => {
  const fluorophore = enrichParsedReagentResult(
    { name: "Anti-CD3 FITC conjugated antibody", catalogNo: "11-0038-42" },
    llmDraft({ category: "ANTIBODY", experimentTags: ["WB_PRIMARY_ANTIBODY"] }),
  );
  const isotype = enrichParsedReagentResult(
    { name: "Mouse IgG1 isotype control", catalogNo: "MOPC-21" },
    llmDraft({ category: "ANTIBODY", experimentTags: ["WB_PRIMARY_ANTIBODY"] }),
  );

  assert.equal(fluorophore.antibodyMeta?.role, null);
  assert.ok(!fluorophore.experimentTags.includes("WB_PRIMARY_ANTIBODY"));
  assert.ok(fluorophore.experimentTags.includes("FLOW_FLUORESCENT_ANTIBODY"));
  assert.equal(isotype.antibodyMeta?.role, null);
  assert.ok(!isotype.experimentTags.includes("WB_PRIMARY_ANTIBODY"));
});

test("enrichment recognizes cell stains and requested consumable families", () => {
  const stain = enrichParsedReagentResult(
    { name: "Calcein AM cell staining solution", catalogNo: "C1430" },
    llmDraft({ category: "CHEMICAL" }),
  );
  const vessel = enrichParsedReagentResult(
    { name: "Tissue culture treated 6-well plate", catalogNo: "3516" },
    llmDraft(),
  );
  const syringe = enrichParsedReagentResult(
    { name: "10 mL Luer-lock syringe", catalogNo: "SY10" },
    llmDraft(),
  );

  assert.ok(stain.experimentTags.includes("CELL_STAIN_REAGENT"));
  assert.equal(stain.subCategory, "Cell Stain");
  assert.equal(vessel.category, "CONSUMABLE");
  assert.ok(vessel.experimentTags.includes("CELL_CULTURE_VESSEL"));
  assert.equal(vessel.subCategory, "Cell Culture Vessel");
  assert.equal(syringe.category, "CONSUMABLE");
  assert.ok(syringe.experimentTags.includes("SYRINGE_CONSUMABLE"));
  assert.equal(syringe.subCategory, "Syringe");
});
