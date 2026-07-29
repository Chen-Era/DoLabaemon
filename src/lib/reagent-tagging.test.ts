import assert from "node:assert/strict";
import test from "node:test";
import { buildHeuristicParse, detectAntibodyMeta, enrichParsedReagentResult } from "@/lib/reagent-tagging";
import { resolveTechniqueReagentCapability } from "@/lib/experiment-techniques/reagent-capabilities";
import { normalizeTargetName, researchDirectionCatalog, ruleCatalog } from "@/lib/rules/catalog";

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
  const completeElisaKit = buildHeuristicParse("ELISA Kit for Annexin A2 (ANXA2)");
  const elisaCaptureComponentKit = buildHeuristicParse("ELISA capture antibody kit");
  const flowPanel = buildHeuristicParse("CD3/CD4/CD8 flow cytometry antibody panel");

  assert.ok(ficoll.experimentTags.includes("DENSITY_GRADIENT_MEDIUM"));
  assert.ok(collagenase.experimentTags.includes("TISSUE_DISSOCIATION_ENZYME"));
  assert.ok(qpcrProbe.experimentTags.includes("QPCR_PROBE"));
  assert.ok(elisaCapture.experimentTags.includes("ELISA_CAPTURE_ANTIBODY"));
  for (const tag of [
    "ELISA_COMPLETE_KIT",
    "ELISA_CAPTURE_ANTIBODY",
    "ELISA_DETECTION_ANTIBODY",
    "ELISA_STANDARD",
    "ELISA_SUBSTRATE",
  ] as const) {
    assert.ok(completeElisaKit.experimentTags.includes(tag), `complete kit must include ${tag}`);
  }
  assert.ok(
    !elisaCaptureComponentKit.experimentTags.includes("ELISA_COMPLETE_KIT"),
    "a component-only kit must not be treated as a complete ELISA kit",
  );
  assert.ok(flowPanel.experimentTags.includes("FLOW_ANTIBODY_PANEL"));
});

test("classifies the new cross-domain reagent tags used by detailed baseline checklists", () => {
  const anticoagulant = buildHeuristicParse("K2 EDTA anticoagulant blood collection tube");
  const histology = buildHeuristicParse("Hematoxylin and eosin staining solution");
  const viability = buildHeuristicParse("MTT cell viability assay kit");
  const microbial = buildHeuristicParse("LB agar microbial culture medium");
  const library = buildHeuristicParse("Illumina library preparation kit");
  const analgesic = buildHeuristicParse("Buprenorphine analgesic solution");
  const chipAntibody = buildHeuristicParse("H3K27ac ChIP-grade antibody");
  const proteinAGBeads = buildHeuristicParse("Protein A/G magnetic beads");
  const transposase = buildHeuristicParse("Tn5 transposase tagmentation kit");
  const rrnaDepletion = buildHeuristicParse("rRNA depletion reagent kit");
  const phosphopeptide = buildHeuristicParse("TiO2 phosphopeptide enrichment kit");
  const tracer = buildHeuristicParse("U-13C6 glucose stable isotope tracer");
  const nucleiIsolation = buildHeuristicParse("Nuclei isolation buffer kit");
  const barcoding = buildHeuristicParse("Single-cell barcoding reagent kit");
  const citePanel = buildHeuristicParse("Oligonucleotide-barcoded antibody panel");
  const spatialPanel = buildHeuristicParse("Spatial RNA probe panel");
  const guideLibrary = buildHeuristicParse("CRISPR sgRNA library");
  const captureProbe = buildHeuristicParse("Target enrichment capture probe panel");
  const bisulfite = buildHeuristicParse("Bisulfite conversion reagent kit");
  const metaboliteExtraction = buildHeuristicParse("Metabolite extraction solvent kit");
  const hostDnaDepletion = buildHeuristicParse("Host DNA depletion kit");

  assert.ok(anticoagulant.experimentTags.includes("ANTICOAGULANT_REAGENT"));
  assert.ok(histology.experimentTags.includes("HISTOLOGY_STAIN_REAGENT"));
  assert.ok(viability.experimentTags.includes("CELL_VIABILITY_ASSAY_REAGENT"));
  assert.ok(microbial.experimentTags.includes("MICROBIAL_CULTURE_MEDIUM"));
  assert.ok(library.experimentTags.includes("LIBRARY_PREPARATION_REAGENT"));
  assert.ok(analgesic.experimentTags.includes("ANALGESIC_REAGENT"));
  assert.ok(chipAntibody.experimentTags.includes("CHIP_GRADE_ANTIBODY"));
  assert.ok(proteinAGBeads.experimentTags.includes("PROTEIN_A_G_MAGNETIC_BEADS"));
  assert.ok(transposase.experimentTags.includes("TRANSPOSASE_REAGENT"));
  assert.ok(rrnaDepletion.experimentTags.includes("RRNA_DEPLETION_REAGENT"));
  assert.ok(phosphopeptide.experimentTags.includes("PHOSPHOPEPTIDE_ENRICHMENT_REAGENT"));
  assert.ok(tracer.experimentTags.includes("STABLE_ISOTOPE_TRACER"));
  assert.ok(nucleiIsolation.experimentTags.includes("NUCLEI_ISOLATION_REAGENT"));
  assert.ok(barcoding.experimentTags.includes("SINGLE_CELL_BARCODING_REAGENT"));
  assert.ok(citePanel.experimentTags.includes("OLIGO_BARCODED_ANTIBODY_PANEL"));
  assert.ok(spatialPanel.experimentTags.includes("SPATIAL_PROBE_PANEL"));
  assert.ok(guideLibrary.experimentTags.includes("CRISPR_GUIDE_LIBRARY"));
  assert.ok(captureProbe.experimentTags.includes("TARGET_ENRICHMENT_PROBE"));
  assert.ok(bisulfite.experimentTags.includes("BISULFITE_CONVERSION_REAGENT"));
  assert.ok(metaboliteExtraction.experimentTags.includes("METABOLITE_EXTRACTION_REAGENT"));
  assert.ok(hostDnaDepletion.experimentTags.includes("HOST_DNA_DEPLETION_REAGENT"));
});

test("recognizes phenotype/pathway reagents for EV, autophagy, ECM, mitochondria, and interferon work", () => {
  const samples = [
    ["Exosome-depleted FBS", "EXOSOME_DEPLETED_SERUM"],
    ["Exosome immunocapture magnetic beads", "EXOSOME_CAPTURE_REAGENT"],
    ["Bafilomycin A1 autophagy flux inhibitor", "AUTOPHAGY_FLUX_INHIBITOR"],
    ["Rapamycin autophagy inducer", "AUTOPHAGY_INDUCER"],
    ["DQ collagen I degradation assay kit", "ECM_DEGRADATION_ASSAY_REAGENT"],
    ["GM6001 MMP inhibitor", "ECM_REMODELING_MODULATOR"],
    ["MitoTracker Deep Red FM", "MITOCHONDRIAL_STAIN"],
    ["JC-1 mitochondrial membrane potential assay kit", "MITOCHONDRIAL_MEMBRANE_POTENTIAL_DYE"],
    ["MitoSOX Red mitochondrial superoxide indicator", "MITOCHONDRIAL_SUPEROXIDE_DYE"],
    ["Seahorse XF Cell Mito Stress Test Kit", "MITOCHONDRIAL_RESPIRATION_ASSAY_REAGENT"],
    ["Oligomycin mitochondrial stressor", "MITOCHONDRIAL_STRESSOR"],
    ["Recombinant human IFN-beta protein", "TYPE_I_INTERFERON_REAGENT"],
    ["IFN-γ recombinant human protein", "TYPE_II_INTERFERON_REAGENT"],
    ["Ruxolitinib JAK1/2 inhibitor", "INTERFERON_PATHWAY_MODULATOR"],
  ] as const;

  for (const [name, tag] of samples) {
    assert.ok(buildHeuristicParse(name).experimentTags.includes(tag), `${name} must include ${tag}`);
  }

  const bafilomycin = buildHeuristicParse("Bafilomycin A1 autophagy flux inhibitor");
  assert.equal(bafilomycin.category, "CHEMICAL");
  assert.equal(normalizeTargetName("IFN-β"), "IFNB1");
  assert.equal(normalizeTargetName("phospho-STAT1"), "STAT1");
});

test("recognizes immune specialization reagents and keeps their stock-check capability mappings canonical", () => {
  const samples = [
    ["LPS innate immune agonist", "INNATE_IMMUNE_STIMULANT"],
    ["Nigericin inflammasome activator", "INFLAMMASOME_ACTIVATOR"],
    ["CD3/CD28 T-cell activation beads", "T_CELL_ACTIVATION_REAGENT"],
    ["Anti-CD3 FITC antibody", "T_CELL_LINEAGE_MARKER_REAGENT"],
    ["Anti-IgM B-cell activation antibody", "B_CELL_ACTIVATION_REAGENT"],
    ["Anti-CD19 APC antibody", "B_CELL_LINEAGE_MARKER_REAGENT"],
    ["Recombinant human IL-15 protein", "NK_CELL_ACTIVATION_REAGENT"],
    ["Anti-CD56 PE antibody", "NK_CELL_MARKER_REAGENT"],
    ["M-CSF macrophage polarization reagent", "MYELOID_POLARIZATION_REAGENT"],
    ["Anti-CD14 BV421 antibody", "MYELOID_LINEAGE_MARKER_REAGENT"],
    ["Pembrolizumab anti-PD-1 checkpoint inhibitor", "IMMUNE_CHECKPOINT_REAGENT"],
    ["2-Deoxy-D-glucose immunometabolism inhibitor", "IMMUNE_METABOLISM_MODULATOR"],
    ["SIINFEKL antigen presentation peptide", "ANTIGEN_PRESENTATION_REAGENT"],
    ["Human complement serum", "COMPLEMENT_FC_EFFECTOR_REAGENT"],
    ["Fc receptor blocking reagent", "FC_RECEPTOR_BLOCKING_REAGENT"],
    ["CD3 microbeads immune cell isolation kit", "IMMUNE_CELL_ENRICHMENT_REAGENT"],
  ] as const;

  for (const [name, tag] of samples) {
    assert.ok(buildHeuristicParse(name).experimentTags.includes(tag), `${name} must include ${tag}`);
  }

  assert.deepEqual(resolveTechniqueReagentCapability("Mitochondrial membrane potential dye").capabilityTags, [
    "MITOCHONDRIAL_MEMBRANE_POTENTIAL_DYE",
  ]);
  assert.deepEqual(resolveTechniqueReagentCapability("T cell activation reagent").capabilityTags, ["T_CELL_ACTIVATION_REAGENT"]);

  const requiredDirectionCodes = [
    "EXOSOME",
    "AUTOPHAGY",
    "ECM_REMODELING",
    "MITOCHONDRIAL_METABOLISM",
    "INTERFERON_RESPONSE",
    "INNATE_INFLAMMATION_INFLAMMASOME",
    "T_CELL_IMMUNITY",
    "B_CELL_HUMORAL_IMMUNITY",
    "NK_CELL_CYTOTOXICITY",
    "MYELOID_INNATE_IMMUNITY",
    "IMMUNE_CHECKPOINT_SUPPRESSION",
    "IMMUNE_METABOLISM",
    "ANTIGEN_PRESENTATION",
    "COMPLEMENT_FC_EFFECTOR",
  ];
  const catalogCodes = new Set<string>(researchDirectionCatalog.map((direction) => direction.code));
  for (const code of requiredDirectionCodes) {
    assert.ok(catalogCodes.has(code), `missing direction ${code}`);
    assert.ok(ruleCatalog.some((rule) => rule.directionCode === code), `missing specialized rules for ${code}`);
  }
});
