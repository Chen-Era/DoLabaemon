import assert from "node:assert/strict";
import test from "node:test";
import { buildHeuristicParse, detectAntibodyMeta, enrichParsedReagentResult } from "@/lib/reagent-tagging";

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

test("tags protein markers and common chemical uses without treating every medium as culture medium", () => {
  const marker = enrichParsedReagentResult(
    { name: "三色预染蛋白Marker 10 kDa~180 kDa", catalogNo: "26616" },
    llmDraft(),
  );
  const anesthetic = enrichParsedReagentResult(
    { name: "即用型三溴乙醇（阿佛丁，Avertin）", catalogNo: "T4840", note: "Small molecule medium" },
    llmDraft({ category: "CHEMICAL", subCategory: "Small Molecule Compound", experimentTags: ["CELL_CULTURE_MEDIUM"] }),
  );
  const ethanol = enrichParsedReagentResult(
    { name: "75% 乙醇水溶液", catalogNo: "E7023" },
    llmDraft(),
  );
  const unspecifiedEthanol = enrichParsedReagentResult(
    { name: "乙醇水溶液", catalogNo: "R20773-500ml" },
    llmDraft(),
  );
  const tribromoethanol = enrichParsedReagentResult(
    { name: "2,2,2-Tribromoethanol, 99%", catalogNo: "T4810" },
    llmDraft(),
  );
  const mountingMedium = buildHeuristicParse("Fluorescence mounting medium with antifade");
  const dmem = buildHeuristicParse("DMEM high glucose");

  assert.ok(marker.experimentTags.includes("WB_PROTEIN_MARKER"));
  assert.equal(marker.category, "BIOLOGICAL");
  assert.equal(marker.subCategory, "Protein Molecular Weight Marker");
  assert.ok(anesthetic.experimentTags.includes("ANESTHETIC_REAGENT"));
  assert.equal(anesthetic.category, "CHEMICAL");
  assert.ok(!anesthetic.experimentTags.includes("CELL_CULTURE_MEDIUM"));
  assert.ok(ethanol.experimentTags.includes("SOLVENT_REAGENT"));
  assert.ok(ethanol.experimentTags.includes("DISINFECTION_REAGENT"));
  assert.equal(ethanol.category, "CHEMICAL");
  assert.ok(unspecifiedEthanol.experimentTags.includes("SOLVENT_REAGENT"));
  assert.ok(!unspecifiedEthanol.experimentTags.includes("DISINFECTION_REAGENT"));
  assert.ok(!tribromoethanol.experimentTags.includes("ANESTHETIC_REAGENT"));
  assert.ok(!mountingMedium.experimentTags.includes("CELL_CULTURE_MEDIUM"));
  assert.ok(mountingMedium.experimentTags.includes("MOUNTING_MEDIUM"));
  assert.ok(dmem.experimentTags.includes("CELL_CULTURE_MEDIUM"));
});

test("classifies the reusable capability tags used by technique readiness", () => {
  const ficoll = buildHeuristicParse("Ficoll-Paque PLUS density gradient medium");
  const collagenase = buildHeuristicParse("Collagenase type I tissue dissociation enzyme");
  const qpcrProbe = buildHeuristicParse("TaqMan qPCR hydrolysis probe");
  const elisaCapture = buildHeuristicParse("Human IL-6 ELISA capture antibody");
  const flowPanel = buildHeuristicParse("CD3/CD4/CD8 flow cytometry antibody panel");

  assert.ok(ficoll.experimentTags.includes("DENSITY_GRADIENT_MEDIUM"));
  assert.ok(collagenase.experimentTags.includes("TISSUE_DISSOCIATION_ENZYME"));
  assert.ok(qpcrProbe.experimentTags.includes("QPCR_PROBE"));
  assert.ok(elisaCapture.experimentTags.includes("ELISA_CAPTURE_ANTIBODY"));
  assert.ok(flowPanel.experimentTags.includes("FLOW_ANTIBODY_PANEL"));
});

test("classifies the new cross-domain reagent tags used by detailed baseline checklists", () => {
  const anticoagulant = buildHeuristicParse("K2 EDTA anticoagulant blood collection tube");
  const histology = buildHeuristicParse("Hematoxylin and eosin staining solution");
  const viability = buildHeuristicParse("MTT cell viability assay kit");
  const microbial = buildHeuristicParse("LB agar microbial culture medium");
  const library = buildHeuristicParse("Illumina library preparation kit");
  const analgesic = buildHeuristicParse("Buprenorphine analgesic solution");

  assert.ok(anticoagulant.experimentTags.includes("ANTICOAGULANT_REAGENT"));
  assert.ok(histology.experimentTags.includes("HISTOLOGY_STAIN_REAGENT"));
  assert.ok(viability.experimentTags.includes("CELL_VIABILITY_ASSAY_REAGENT"));
  assert.ok(microbial.experimentTags.includes("MICROBIAL_CULTURE_MEDIUM"));
  assert.ok(library.experimentTags.includes("LIBRARY_PREPARATION_REAGENT"));
  assert.ok(analgesic.experimentTags.includes("ANALGESIC_REAGENT"));
});
