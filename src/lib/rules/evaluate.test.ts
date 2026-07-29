import test from "node:test";
import assert from "node:assert/strict";
import { ruleCatalog } from "@/lib/rules/catalog";
import { evaluateRules, type EvaluatableReagent } from "@/lib/rules/evaluate";
import { checkWbAntibodyCompatibility } from "@/lib/rules/wb-antibody-check";
import { demoCheckExperiment, demoConfirmReagent, demoParseReagent } from "@/lib/demo-store";
import { buildHeuristicParse } from "@/lib/reagent-tagging";

function rulesFor(experimentCode: string, directionCode?: string) {
  return ruleCatalog.filter((rule) => {
    if (rule.experimentCode !== experimentCode) return false;
    if (!rule.directionCode) return true;
    return rule.directionCode === directionCode;
  });
}

test("WB missing minimum requirement becomes BLOCKED", () => {
  const reagents: EvaluatableReagent[] = [
    { name: "RIPA", experimentTags: ["WB_LYSIS_BUFFER"] },
    { name: "Laemmli", experimentTags: ["WB_LOADING_BUFFER"] },
    { name: "Anti-LC3B rabbit primary antibody", antibodyMeta: { role: "PRIMARY", hostSpecies: "Rabbit", targetName: "LC3B" } },
    { name: "Goat anti-rabbit HRP secondary antibody", experimentTags: ["WB_SECONDARY_ANTIBODY"], antibodyMeta: { role: "SECONDARY", targetSpecies: "rabbit" } },
    { name: "GAPDH antibody", antibodyMeta: { role: "PRIMARY", hostSpecies: "Mouse", targetName: "GAPDH" } },
  ];

  const result = evaluateRules({ rules: rulesFor("WB"), reagents, lang: "zh" });
  assert.equal(result.status, "BLOCKED");
  assert.ok(result.minMissing.includes("WB 需要检测底物"));
});

test("WB antibody compatibility reports mismatched species", () => {
  const issues = checkWbAntibodyCompatibility([
    { role: "PRIMARY", hostSpecies: "Rabbit" },
    { role: "SECONDARY", targetSpecies: "Mouse" },
  ]);
  assert.equal(issues.length, 1);
});

test("qPCR without reference primer becomes BLOCKED", () => {
  const reagents: EvaluatableReagent[] = [
    { name: "TRIzol", experimentTags: ["RNA_EXTRACTION_REAGENT"] },
    { name: "RT kit", experimentTags: ["REVERSE_TRANSCRIPTION_REAGENT"] },
    { name: "SYBR master mix", experimentTags: ["QPCR_MASTER_MIX"] },
    { name: "MAP1LC3B primer", primerMeta: { targetName: "MAP1LC3B", isReferenceGene: false } },
    { name: "Nuclease-free water", experimentTags: ["NUCLEASE_FREE_WATER"] },
  ];

  const result = evaluateRules({ rules: rulesFor("QPCR"), reagents, lang: "zh" });
  assert.equal(result.status, "BLOCKED");
  assert.ok(result.minMissing.includes("qPCR 至少一个内参引物"));
});

test("EXOSOME WB passes with one tetraspanin and one cytosolic marker", () => {
  const reagents: EvaluatableReagent[] = [
    { name: "RIPA", experimentTags: ["WB_LYSIS_BUFFER"] },
    { name: "Laemmli", experimentTags: ["WB_LOADING_BUFFER"] },
    { name: "Anti-CD63 rabbit primary antibody", antibodyMeta: { role: "PRIMARY", hostSpecies: "Rabbit", targetName: "CD63" } },
    { name: "Anti-TSG101 rabbit primary antibody", antibodyMeta: { role: "PRIMARY", hostSpecies: "Rabbit", targetName: "TSG101" } },
    { name: "Goat anti-rabbit HRP secondary antibody", experimentTags: ["WB_SECONDARY_ANTIBODY"], antibodyMeta: { role: "SECONDARY", targetSpecies: "rabbit" } },
    { name: "GAPDH antibody", antibodyMeta: { role: "PRIMARY", hostSpecies: "Mouse", targetName: "GAPDH" } },
    { name: "ECL", experimentTags: ["WB_DETECTION_SUBSTRATE"] },
  ];

  const result = evaluateRules({ rules: rulesFor("WB", "EXOSOME"), reagents, lang: "zh" });
  assert.equal(result.status, "PASS");
  assert.ok(result.recommendedMissing.includes("推荐补充 Calnexin 作为污染排查"));
});

test("DEMO_MODE shares the same rule catalog outcome", () => {
  const labId = `demo-lab-${Date.now()}`;
  const userId = "demo-user";
  const reagentNames = [
    "RIPA lysis buffer",
    "Laemmli sample buffer",
    "Anti-CD63 rabbit primary antibody",
    "Anti-TSG101 rabbit primary antibody",
    "Goat anti-rabbit HRP secondary antibody",
    "GAPDH antibody",
    "SuperSignal ECL substrate",
  ];

  for (const name of reagentNames) {
    const parsed = demoParseReagent({ labId, userId, name });
    demoConfirmReagent({
      draftId: parsed.draftId,
      editedPayload: {
        labId,
        name,
        catalogNo: `${name}-cat`,
        category: parsed.parsed.category,
        subCategory: parsed.parsed.subCategory,
        vendor: parsed.parsed.vendor,
        experimentTags: parsed.parsed.experimentTags,
        antibodyMeta: parsed.parsed.antibodyMeta ?? null,
        primerMeta: parsed.parsed.primerMeta ?? null,
      },
    });
  }

  const demoResult = demoCheckExperiment({ labId, experimentType: "WB", direction: "EXOSOME", prerequisite: "EV enrichment" });
  const evalResult = evaluateRules({
    rules: rulesFor("WB", "EXOSOME"),
    reagents: [
      { name: "RIPA lysis buffer", experimentTags: ["WB_LYSIS_BUFFER"] },
      { name: "Laemmli sample buffer", experimentTags: ["WB_LOADING_BUFFER"] },
      { name: "Anti-CD63 rabbit primary antibody", antibodyMeta: { role: "PRIMARY", hostSpecies: "Rabbit", targetName: "CD63" } },
      { name: "Anti-TSG101 rabbit primary antibody", antibodyMeta: { role: "PRIMARY", hostSpecies: "Rabbit", targetName: "TSG101" } },
      { name: "Goat anti-rabbit HRP secondary antibody", experimentTags: ["WB_SECONDARY_ANTIBODY"], antibodyMeta: { role: "SECONDARY", targetSpecies: "rabbit" } },
      { name: "GAPDH antibody", antibodyMeta: { role: "PRIMARY", hostSpecies: "Mouse", targetName: "GAPDH" } },
      { name: "SuperSignal ECL substrate", experimentTags: ["WB_DETECTION_SUBSTRATE"] },
    ],
    lang: "zh",
  });

  assert.equal(demoResult.status, evalResult.status);
  assert.deepEqual(demoResult.minMissing, evalResult.minMissing);
  assert.deepEqual(demoResult.recommendedMissing, evalResult.recommendedMissing);
});

test("lipo3000 is tagged as a transfection reagent in demo heuristic", () => {
  const parsed = demoParseReagent({
    labId: `demo-lab-lipo-${Date.now()}`,
    userId: "demo-user",
    name: "lipo3000",
  });

  assert.equal(parsed.parsed.category, "CHEMICAL");
  assert.equal(parsed.parsed.subCategory, "Transfection Reagent");
  assert.ok(parsed.parsed.experimentTags.includes("TRANSFECTION_REAGENT"));
});

test("fine-grained heuristic tags cover common reagent families", () => {
  const dmem = buildHeuristicParse("DMEM high glucose");
  const puromycin = buildHeuristicParse("Puromycin dihydrochloride");
  const pvdf = buildHeuristicParse("PVDF membrane");
  const bca = buildHeuristicParse("BCA Protein Assay Kit");
  const exosome = buildHeuristicParse("ExoQuick exosome isolation reagent");

  assert.ok(dmem.experimentTags.includes("CELL_CULTURE_MEDIUM"));
  assert.ok(puromycin.experimentTags.includes("SELECTION_ANTIBIOTIC"));
  assert.ok(pvdf.experimentTags.includes("WB_TRANSFER_MEMBRANE"));
  assert.ok(bca.experimentTags.includes("PROTEIN_QUANTIFICATION_REAGENT"));
  assert.ok(exosome.experimentTags.includes("EXOSOME_ISOLATION_REAGENT"));
});

test("recombinant protein family is recognized as biological reagent", () => {
  const srankl = buildHeuristicParse("Soluble RANK Ligand (sRANKL) Protein, Recombinant human");

  assert.equal(srankl.category, "BIOLOGICAL");
  assert.equal(srankl.subCategory, "Recombinant Protein");
  assert.ok(srankl.confidence >= 0.86);
  assert.ok(srankl.experimentTags.includes("CELL_STIMULATION_REAGENT"));
  assert.ok(srankl.experimentTags.includes("SIGNALING_MODULATOR"));
  assert.ok(srankl.experimentTags.includes("OSTEOCLAST_DIFFERENTIATION_REAGENT"));
  assert.ok(srankl.experimentTags.includes("BONE_REMODELING_SIGNAL"));
});

test("fallback parsing uses note and catalog context for biological reagents", () => {
  const parsed = buildHeuristicParse({
    name: "sRANKL",
    catalogNo: "HZ-1234",
    note: "Soluble RANK Ligand recombinant human protein",
  });

  assert.equal(parsed.category, "BIOLOGICAL");
  assert.equal(parsed.subCategory, "Recombinant Protein");
});

test("gene perturbation reagents are classified beyond transfection agents", () => {
  const plasmid = buildHeuristicParse("pcDNA3.1 FLAG-LC3B expression plasmid");
  const sirna = buildHeuristicParse("LC3B siRNA smartpool");

  assert.equal(plasmid.category, "BIOLOGICAL");
  assert.equal(plasmid.subCategory, "Expression Plasmid");
  assert.ok(plasmid.experimentTags.includes("GENE_DELIVERY_REAGENT"));

  assert.equal(sirna.category, "BIOLOGICAL");
  assert.equal(sirna.subCategory, "siRNA");
  assert.ok(sirna.experimentTags.includes("GENE_DELIVERY_REAGENT"));
});

test("fine semantic tags cover cytokine, osteogenic and matrix contexts", () => {
  const il6 = buildHeuristicParse("Recombinant human IL-6 protein");
  const bmp2 = buildHeuristicParse("BMP2 recombinant protein");
  const matrigel = buildHeuristicParse("Growth factor reduced Matrigel matrix");

  assert.ok(il6.experimentTags.includes("IMMUNE_CYTOKINE_REAGENT"));
  assert.ok(bmp2.experimentTags.includes("OSTEOGENIC_DIFFERENTIATION_REAGENT"));
  assert.ok(bmp2.experimentTags.includes("BONE_REMODELING_SIGNAL"));
  assert.ok(matrigel.experimentTags.includes("ECM_COATING_REAGENT"));
  assert.ok(matrigel.experimentTags.includes("STEM_CELL_MATRIX"));
});

test("new fine-grained tags reduce recommended gaps in WB and qPCR", () => {
  const wbResult = evaluateRules({
    rules: rulesFor("WB"),
    reagents: [
      { name: "RIPA", experimentTags: ["WB_LYSIS_BUFFER"] },
      { name: "Laemmli", experimentTags: ["WB_LOADING_BUFFER"] },
      { name: "Anti-GAPDH rabbit primary antibody", antibodyMeta: { role: "PRIMARY", hostSpecies: "Rabbit", targetName: "GAPDH" } },
      { name: "Goat anti-rabbit HRP secondary antibody", experimentTags: ["WB_SECONDARY_ANTIBODY"], antibodyMeta: { role: "SECONDARY", targetSpecies: "rabbit" } },
      { name: "ECL", experimentTags: ["WB_DETECTION_SUBSTRATE"] },
      { name: "PVDF membrane", experimentTags: ["WB_TRANSFER_MEMBRANE"] },
      { name: "BCA kit", experimentTags: ["PROTEIN_QUANTIFICATION_REAGENT"] },
      { name: "DTT", experimentTags: ["REDUCING_AGENT"] },
    ],
    lang: "zh",
  });

  assert.equal(wbResult.status, "PASS");
  assert.ok(!wbResult.recommendedMissing.includes("推荐补充 WB 转印膜"));
  assert.ok(!wbResult.recommendedMissing.includes("推荐补充蛋白定量试剂"));
  assert.ok(!wbResult.recommendedMissing.includes("推荐补充还原剂"));

  const qpcrResult = evaluateRules({
    rules: rulesFor("QPCR"),
    reagents: [
      { name: "TRIzol", experimentTags: ["RNA_EXTRACTION_REAGENT"] },
      { name: "RT kit", experimentTags: ["REVERSE_TRANSCRIPTION_REAGENT"] },
      { name: "SYBR master mix", experimentTags: ["QPCR_MASTER_MIX"] },
      { name: "GAPDH primer", primerMeta: { targetName: "GAPDH", isReferenceGene: true } },
      { name: "LC3 primer", primerMeta: { targetName: "LC3", isReferenceGene: false } },
      { name: "Nuclease-free water", experimentTags: ["NUCLEASE_FREE_WATER"] },
      { name: "DMEM", experimentTags: ["CELL_CULTURE_MEDIUM"] },
      { name: "FBS", experimentTags: ["SERUM_SUPPLEMENT"] },
    ],
    lang: "zh",
  });

  assert.equal(qpcrResult.status, "PASS");
  assert.ok(!qpcrResult.recommendedMissing.includes("推荐补充细胞培养基"));
  assert.ok(!qpcrResult.recommendedMissing.includes("推荐补充血清添加物"));
});

test("ELISA can be evaluated with the new experiment type catalog", () => {
  const result = evaluateRules({
    rules: rulesFor("ELISA"),
    reagents: [
      { name: "ELISA coating buffer", experimentTags: ["ELISA_COATING_REAGENT"] },
      { name: "ELISA blocking buffer", experimentTags: ["ELISA_BLOCKING_REAGENT"] },
      { name: "ELISA wash buffer", experimentTags: ["ELISA_WASH_BUFFER"] },
      { name: "Biotinylated detection antibody", experimentTags: ["ELISA_DETECTION_ANTIBODY"] },
      { name: "TMB substrate", experimentTags: ["ELISA_SUBSTRATE"] },
    ],
    lang: "zh",
  });

  assert.equal(result.status, "PASS");
});

test("one explicitly complete ELISA kit satisfies the legacy ELISA rule bundle", () => {
  const result = evaluateRules({
    rules: rulesFor("ELISA"),
    reagents: [{ name: "ELISA Kit for Annexin A2 (ANXA2)", experimentTags: [] }],
    lang: "zh",
  });

  assert.equal(result.status, "PASS");
  assert.ok(
    result.items
      .filter((item) => !item.isMissing)
      .every((item) => item.matchedName === "ELISA Kit for Annexin A2 (ANXA2)"),
  );
});
