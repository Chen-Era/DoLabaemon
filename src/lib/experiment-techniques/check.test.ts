import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { evaluateTechniqueReadiness } from "@/lib/experiment-techniques/check";
import { repositoryTechniqueByCode } from "@/lib/experiment-techniques/catalog";
import { experimentTechniqueSchema } from "@/lib/experiment-techniques/types";
import { experimentTags } from "@/lib/rules/catalog";
import type {
  ExperimentTechnique,
  TechniqueRequirement,
} from "@/lib/experiment-techniques/types";
import type { InventoryCapability } from "@/lib/experiment-techniques/check";

const BASE_CODE = "SANDWICH_ELISA";
const PROFILE_CODE = "QPCR";

function leafFixture(code: string = BASE_CODE): ExperimentTechnique {
  const technique = repositoryTechniqueByCode.get(code);
  assert.ok(technique, `repository catalog must contain ${code}`);
  assert.equal(technique.isAbstract, false, `${code} must be a leaf technique`);
  const clone = structuredClone(technique);
  const parsed = experimentTechniqueSchema.safeParse(clone);
  assert.ok(parsed.success, `fixture ${code} must pass experimentTechniqueSchema`);
  return clone;
}

/** Inventory that satisfies every AUTO_INVENTORY requirement via canonical reagent tags. */
function makeInventory(requirements: TechniqueRequirement[]): InventoryCapability[] {
  return requirements
    .filter((requirement) => requirement.verificationMode === "AUTO_INVENTORY")
    .map((requirement) => ({
      id: `inv-${requirement.id}`,
      name: requirement.matcherValues[0] ?? requirement.label.en,
      experimentTags: [...requirement.capabilityTags],
    }));
}

function manualConfirmationIds(requirements: TechniqueRequirement[]): string[] {
  return requirements
    .filter((requirement) => requirement.verificationMode === "MANUAL_CONFIRMATION")
    .map((requirement) => requirement.id);
}

function makeReadyInput(technique: ExperimentTechnique, profileCode: string | null = null) {
  const profile = profileCode
    ? technique.profiles.find((item) => item.code === profileCode)
    : null;
  const requirements = [
    ...technique.requirements,
    ...(profile?.additionalRequirements ?? []),
  ];
  return {
    technique,
    profileCode,
    inventory: makeInventory(requirements),
    confirmedRequirementIds: requirements
      .filter(
        (requirement) =>
          requirement.verificationMode === "MANUAL_CONFIRMATION" ||
          requirement.level === "CONDITIONAL",
      )
      .map((requirement) => requirement.id),
  };
}

function conditionalRequirement(): TechniqueRequirement {
  return {
    id: "fixture:conditional:biospecimen-permit",
    kind: "SAMPLE",
    level: "CONDITIONAL",
    verificationMode: "MANUAL_CONFIRMATION",
    label: { zh: "特殊样本许可", en: "Special specimen permit" },
    capabilityTags: [],
    matcherValues: [],
    condition: {
      zh: "仅当样本属于受监管类别时适用。",
      en: "Applies only when the specimen is in a regulated category.",
    },
  };
}

describe("evaluateTechniqueReadiness fixture", () => {
  it("clones a real leaf technique that passes the schema", () => {
    const fixture = leafFixture();
    assert.equal(fixture.code, BASE_CODE);
    assert.equal(fixture.status, "PUBLISHED");
    const kinds = new Set(fixture.requirements.map((item) => item.kind));
    for (const kind of ["REAGENT", "CONSUMABLE", "INSTRUMENT", "SAMPLE", "CONTROL", "SOFTWARE"]) {
      assert.ok(kinds.has(kind as TechniqueRequirement["kind"]), `fixture covers ${kind}`);
    }
  });
});

describe("evaluateTechniqueReadiness status matrix", () => {
  it("returns READY when inventory matches AUTO_INVENTORY reagents and all manual requirements are confirmed", () => {
    const technique = leafFixture();
    const result = evaluateTechniqueReadiness(makeReadyInput(technique));
    assert.equal(result.status, "READY");
    assert.deepEqual(result.reasons, []);
    assert.ok(result.items.length > 0);
    for (const item of result.items) {
      assert.ok(
        item.state === "MATCHED" || item.state === "CONFIRMED",
        `item ${item.requirementId} should be MATCHED/CONFIRMED, got ${item.state}`,
      );
    }
  });

  it("returns BLOCKED when a required AUTO_INVENTORY reagent is missing from inventory", () => {
    const technique = leafFixture();
    const result = evaluateTechniqueReadiness({
      technique,
      inventory: [],
      confirmedRequirementIds: manualConfirmationIds(technique.requirements),
    });
    assert.equal(result.status, "BLOCKED");
    assert.ok(
      result.items.some(
        (item) =>
          item.kind === "REAGENT" &&
          item.level === "REQUIRED" &&
          item.verificationMode === "AUTO_INVENTORY" &&
          item.state === "MISSING",
      ),
      "expected at least one MISSING required AUTO_INVENTORY reagent",
    );
    assert.ok(result.reasons.length > 0);
  });

  it("returns NEEDS_CONFIRMATION when a manual REQUIRED requirement is not confirmed", () => {
    const technique = leafFixture();
    const confirmed = manualConfirmationIds(technique.requirements);
    const withheld = confirmed[0];
    const result = evaluateTechniqueReadiness({
      technique,
      inventory: makeInventory(technique.requirements),
      confirmedRequirementIds: confirmed.filter((id) => id !== withheld),
    });
    assert.equal(result.status, "NEEDS_CONFIRMATION");
    const item = result.items.find((entry) => entry.requirementId === withheld);
    assert.equal(item?.state, "UNCONFIRMED");
  });
});

describe("canonical reagent capability tags", () => {
  it("uses only the shared reagent tag vocabulary for automatic inventory checks", () => {
    const knownTags = new Set<string>(experimentTags);
    for (const technique of repositoryTechniqueByCode.values()) {
      for (const requirement of [
        ...technique.requirements,
        ...technique.profiles.flatMap((profile) => profile.additionalRequirements),
      ]) {
        for (const tag of requirement.capabilityTags) {
          assert.ok(knownTags.has(tag), `${technique.code} references unknown reagent tag ${tag}`);
        }
        if (requirement.verificationMode === "AUTO_INVENTORY" && requirement.kind === "REAGENT") {
          assert.ok(requirement.capabilityTags.length > 0, `${technique.code} auto requirement needs a canonical tag`);
        }
      }
    }
  });

  it("matches a real qPCR inventory tag without using category or free-text fallback", () => {
    const technique = leafFixture("QPCR");
    const requirements = technique.requirements;
    const result = evaluateTechniqueReadiness({
      technique,
      inventory: requirements
        .filter((requirement) => requirement.verificationMode === "AUTO_INVENTORY")
        .map((requirement, index) => ({
          id: `qpcr-${index}`,
          name: requirement.label.zh,
          experimentTags: [...requirement.capabilityTags],
        })),
      confirmedRequirementIds: manualConfirmationIds(requirements),
    });
    assert.equal(result.status, "READY");
  });

  it("does not treat an untagged similarly named inventory item as a reagent match", () => {
    const technique = leafFixture("QPCR");
    const result = evaluateTechniqueReadiness({
      technique,
      inventory: [{ id: "untagged", name: "qPCR amplification chemistry", experimentTags: [] }],
      confirmedRequirementIds: manualConfirmationIds(technique.requirements),
    });
    assert.equal(result.status, "BLOCKED");
  });

  it("lets one explicitly complete ELISA kit satisfy the sandwich-ELISA reagent bundle", () => {
    const technique = leafFixture("SANDWICH_ELISA");
    const result = evaluateTechniqueReadiness({
      technique,
      inventory: [
        {
          id: "anxa2-elisa-kit",
          name: "ELISA Kit for Annexin A2 (ANXA2)",
          experimentTags: [],
        },
      ],
      confirmedRequirementIds: manualConfirmationIds(technique.requirements),
    });

    assert.equal(result.status, "READY");
    for (const item of result.items.filter(
      (item) => item.kind === "REAGENT" && item.verificationMode === "AUTO_INVENTORY",
    )) {
      assert.equal(item.state, "MATCHED", `${item.label} must be covered by the kit`);
      assert.equal(item.matchedName, "ELISA Kit for Annexin A2 (ANXA2)");
    }
  });

  it("does not treat a component-only ELISA kit as a complete assay", () => {
    const technique = leafFixture("SANDWICH_ELISA");
    const result = evaluateTechniqueReadiness({
      technique,
      inventory: [
        {
          id: "capture-antibody-kit",
          name: "ELISA capture antibody kit",
          experimentTags: ["ELISA_CAPTURE_ANTIBODY"],
        },
      ],
      confirmedRequirementIds: manualConfirmationIds(technique.requirements),
    });

    assert.equal(result.status, "BLOCKED");
  });

  it("gives every leaf technique a multi-item reagent checklist with an automatic inventory check", () => {
    for (const technique of repositoryTechniqueByCode.values()) {
      if (technique.isAbstract) continue;
      const reagents = technique.requirements.filter(
        (requirement) => requirement.kind === "REAGENT",
      );
      assert.ok(
        reagents.length >= 3,
        `${technique.code} must have at least three reagent requirements`,
      );
      assert.ok(
        reagents.some(
          (requirement) =>
            requirement.verificationMode === "AUTO_INVENTORY" &&
            requirement.capabilityTags.length > 0,
        ),
        `${technique.code} must retain at least one canonical automatic reagent check`,
      );
    }
  });

  it("keeps representative qPCR, flow, and immunofluorescence requirements specific", () => {
    const reagentTags = (code: string) => {
      const technique = leafFixture(code);
      return new Set<string>(
        technique.requirements
          .filter((requirement) => requirement.kind === "REAGENT")
          .flatMap((requirement) => requirement.capabilityTags),
      );
    };

    const qpcrTags = reagentTags("QPCR");
    for (const tag of ["QPCR_MASTER_MIX", "PCR_PRIMER_SET", "NUCLEASE_FREE_WATER"] as const) {
      assert.ok(qpcrTags.has(tag), `QPCR must require ${tag}`);
    }

    const flowTags = reagentTags("FLOW");
    for (const tag of ["FLOW_ANTIBODY_PANEL", "FLOW_STAIN_BUFFER", "FLOW_VIABILITY_DYE"] as const) {
      assert.ok(flowTags.has(tag), `FLOW must require ${tag}`);
    }

    const ifTags = reagentTags("IF");
    assert.ok(ifTags.has("FIXATIVE"), "IF must include a fixative check");
    assert.ok(ifTags.has("MOUNTING_MEDIUM"), "IF must include a mounting-medium check");
  });

  it("exposes study-specific profiles for representative integrative-biology domains", () => {
    for (const [code, profileCode, targetPhrase] of [
      ["CHIP_QPCR", "REGULATORY_LOCUS_VALIDATION", "目标位点"],
      ["SINGLE_CELL_MULTIOME_RNA_ATAC_SEQUENCING", "CELL_ATLAS_REGULATORY_NETWORK", "目标细胞类型"],
      ["CITE_SEQUENCING", "IMMUNE_PHENOTYPE_RNA_PROTEIN", "免疫谱系"],
      ["IMAGING_BASED_SPATIAL_TRANSCRIPTOMICS", "SPATIAL_TARGETED_PANEL", "目标基因"],
      ["PHOSPHOPROTEOMICS", "SIGNALING_NETWORK", "磷酸化位点"],
      ["STABLE_ISOTOPE_TRACING_METABOLOMICS", "METABOLIC_FLUX", "示踪底物"],
      ["POOLED_CRISPR_CAS9_SCREEN", "CAUSAL_GENE_SCREEN", "目标基因集"],
      ["SHOTGUN_METAGENOMIC_SEQUENCING", "HOST_MICROBIOME_FUNCTION", "功能通路"],
      ["ORGANOID_CULTURE", "DEVELOPMENTAL_DISEASE_MODEL", "目标组织谱系"],
    ] as const) {
      const technique = leafFixture(code);
      const profile = technique.profiles.find((item) => item.code === profileCode);
      assert.ok(profile, `${code} must expose ${profileCode}`);
      assert.ok(
        profile.additionalRequirements.some((item) => item.label.zh.includes(targetPhrase)),
        `${code}/${profileCode} must retain target-specific guidance`,
      );
      assert.equal(
        evaluateTechniqueReadiness(makeReadyInput(technique, profileCode)).status,
        "READY",
        `${code}/${profileCode} must be checkable when all requirements are fulfilled`,
      );
    }
  });

  it("exposes phenotype/pathway profiles with target panels and biological controls", () => {
    for (const [code, profileCode, targetPhrase] of [
      ["WB", "AUTOPHAGY_FLUX_WB", "LC3B"],
      ["WB", "ECM_REMODELING_WB", "COL1A1"],
      ["WB", "MITOCHONDRIAL_BIOENERGETICS_WB", "OXPHOS"],
      ["WB", "HISTONE_ACETYLATION_WB", "H3K27ac"],
      ["WB", "HISTONE_METHYLATION_WB", "H3K4me3"],
      ["WB", "HISTONE_LACTYLATION_WB", "H3K18la"],
      ["WB", "PHOSPHORYLATION_KINASE_WB", "p-ERK"],
      ["WB", "INFLAMMASOME_PYROPTOSIS_WB", "NLRP3"],
      ["CHIP_QPCR", "HISTONE_ACETYLATION_CHIP_QPCR", "H3K27ac"],
      ["CHIP_QPCR", "HISTONE_METHYLATION_CHIP_QPCR", "H3K4me3"],
      ["CHIP_QPCR", "HISTONE_LACTYLATION_CHIP_QPCR", "H3K18la"],
      ["CHIP_QPCR", "DNA_METHYLATION_ENRICHMENT_QPCR", "5mC"],
      ["CUT_AND_TAG", "HISTONE_ACETYLATION_CUT", "H3K27ac"],
      ["ATAC_QPCR", "CHROMATIN_ACCESSIBILITY_ATAC_QPCR", "Tn5"],
      ["ATAC_SEQUENCING", "CHROMATIN_ACCESSIBILITY_ATAC_SEQ", "Tn5"],
      ["SINGLE_CELL_ATAC_SEQUENCING", "SINGLE_CELL_CHROMATIN_ATLAS", "Tn5"],
      ["WHOLE_GENOME_BISULFITE_SEQUENCING", "DNA_METHYLATION_WGBS", "亚硫酸"],
      ["DNA_METHYLATION_ARRAY", "DNA_METHYLATION_ARRAY_PROFILE", "基因组 DNA"],
      ["PHOSPHOPROTEOMICS", "PHOSPHORYLATION_KINASE_NETWORK", "磷酸肽"],
      ["PHOSPHO_FLOW", "PHOSPHORYLATION_SIGNALING_FLOW", "p-ERK"],
      ["TARGETED_LC_MS_MS_QUANTIFICATION", "TARGETED_PHOSPHOSITE_MS", "磷酸肽"],
      ["IF", "MITOCHONDRIAL_MORPHOLOGY_IF", "TOMM20"],
      ["IF", "INFLAMMASOME_ASC_SPECK_IF", "ASC"],
      ["FLOW", "INNATE_INFLAMMATION_FLOW", "caspase-1"],
      ["FLOW", "T_CELL_IMMUNITY_FLOW", "CD3"],
      ["FLOW", "B_CELL_HUMORAL_FLOW", "CD19"],
      ["FLOW", "NK_CELL_CYTOTOXICITY_FLOW", "CD56"],
      ["FLOW", "MYELOID_INNATE_FLOW", "CD11b"],
      ["FLOW", "IMMUNE_CHECKPOINT_FLOW", "PD-1"],
      ["FLOW", "IMMUNE_METABOLISM_FLOW", "2-NBDG"],
      ["FLOW", "ANTIGEN_PRESENTATION_FLOW", "HLA-DR"],
      ["FLOW", "COMPLEMENT_FC_EFFECTOR_FLOW", "C3b"],
      ["FLOW", "IMMUNE_TRAFFICKING_FLOW", "CXCR3"],
      ["SANDWICH_ELISA", "B_CELL_HUMORAL_ELISA", "IgG"],
      ["SANDWICH_ELISA", "MYELOID_CYTOKINE_ELISA", "TNF"],
      ["MULTICOLOR_IMMUNOPHENOTYPING", "T_CELL_ACTIVATION_EXHAUSTION_PANEL", "CD3"],
      ["MULTICOLOR_IMMUNOPHENOTYPING", "MYELOID_INNATE_PANEL", "CD11b"],
      ["INTRACELLULAR_CYTOKINE_FLOW", "T_CELL_POLYFUNCTIONAL_ICS", "IFN-γ"],
      ["INTRACELLULAR_CYTOKINE_FLOW", "NK_FUNCTIONAL_ICS", "CD56"],
      ["TRANSWELL_MIGRATION", "IMMUNE_TRAFFICKING_MIGRATION", "CXCR3"],
      ["ADCC_ASSAY", "NK_ADCC_FC_EFFECTOR", "CD16"],
      ["PHAGOCYTOSIS_ASSAY", "COMPLEMENT_FC_OPSONOPHAGOCYTOSIS", "补体"],
      ["SEAHORSE_OCR_ECAR", "MITOCHONDRIAL_STRESS_TEST", "FCCP"],
    ] as const) {
      const technique = leafFixture(code);
      const profile = technique.profiles.find((item) => item.code === profileCode);
      assert.ok(profile, `${code} must expose ${profileCode}`);
      assert.ok(
        profile.additionalRequirements.some((item) => item.label.zh.includes(targetPhrase)),
        `${code}/${profileCode} must name a specialized target panel`,
      );
      assert.ok(
        profile.additionalRequirements.some((item) => item.kind === "CONTROL"),
        `${code}/${profileCode} must specify an interpretable biological control`,
      );
      assert.equal(
        evaluateTechniqueReadiness(makeReadyInput(technique, profileCode)).status,
        "READY",
        `${code}/${profileCode} must be checkable when all requirements are fulfilled`,
      );
    }
  });
});

describe("evaluateTechniqueReadiness UNSUPPORTED branches", () => {
  it("returns UNSUPPORTED when status is not PUBLISHED", () => {
    const technique = leafFixture();
    technique.status = "DEPRECATED";
    const result = evaluateTechniqueReadiness(makeReadyInput(technique));
    assert.equal(result.status, "UNSUPPORTED");
    assert.match(result.reasons.join(" "), /PUBLISHED/);
  });

  it("returns UNSUPPORTED when the technique isAbstract (navigation family)", () => {
    const technique = leafFixture();
    technique.isAbstract = true;
    const result = evaluateTechniqueReadiness(makeReadyInput(technique));
    assert.equal(result.status, "UNSUPPORTED");
    assert.match(result.reasons.join(" "), /family|abstract|leaf/i);
  });

  it("returns UNSUPPORTED when requirements are empty", () => {
    const technique = leafFixture();
    technique.requirements = [];
    const result = evaluateTechniqueReadiness({ technique });
    assert.equal(result.status, "UNSUPPORTED");
    assert.match(result.reasons.join(" "), /no resource requirements/i);
  });

  it("returns UNSUPPORTED when a requirement kind dimension is missing", () => {
    const technique = leafFixture();
    technique.requirements = technique.requirements.filter(
      (requirement) => requirement.kind !== "SOFTWARE",
    );
    const result = evaluateTechniqueReadiness(makeReadyInput(technique));
    assert.equal(result.status, "UNSUPPORTED");
    assert.match(result.reasons.join(" "), /incomplete resource dimensions/i);
    assert.match(result.reasons.join(" "), /SOFTWARE/);
  });

  it("returns UNSUPPORTED when profileCode does not exist on the technique", () => {
    const technique = leafFixture();
    const result = evaluateTechniqueReadiness({
      ...makeReadyInput(technique),
      profileCode: "NO_SUCH_PROFILE",
    });
    assert.equal(result.status, "UNSUPPORTED");
    assert.match(result.reasons.join(" "), /Unknown profile/);
  });

  it("returns UNSUPPORTED when the technique object fails structural validation", () => {
    const technique = leafFixture();
    const broken = { ...technique } as Record<string, unknown>;
    delete broken.name;
    const result = evaluateTechniqueReadiness({
      technique: broken as unknown as ExperimentTechnique,
    });
    assert.equal(result.status, "UNSUPPORTED");
    assert.match(result.reasons.join(" "), /structural validation/i);
  });
});

describe("evaluateTechniqueReadiness CONDITIONAL requirements", () => {
  it("unconfirmed CONDITIONAL requirement leads to NEEDS_CONFIRMATION", () => {
    const technique = leafFixture();
    technique.requirements.push(conditionalRequirement());
    const input = makeReadyInput(technique);
    input.confirmedRequirementIds = input.confirmedRequirementIds.filter(
      (id) => id !== "fixture:conditional:biospecimen-permit",
    );
    const result = evaluateTechniqueReadiness(input);
    assert.equal(result.status, "NEEDS_CONFIRMATION");
    const item = result.items.find(
      (entry) => entry.requirementId === "fixture:conditional:biospecimen-permit",
    );
    assert.equal(item?.state, "UNCONFIRMED");
  });

  it("confirmed CONDITIONAL requirement allows READY with state CONFIRMED", () => {
    const technique = leafFixture();
    technique.requirements.push(conditionalRequirement());
    const result = evaluateTechniqueReadiness(makeReadyInput(technique));
    assert.equal(result.status, "READY");
    const item = result.items.find(
      (entry) => entry.requirementId === "fixture:conditional:biospecimen-permit",
    );
    assert.equal(item?.state, "CONFIRMED");
  });

  it("CONDITIONAL requirement listed as not-applicable allows READY with state NOT_APPLICABLE", () => {
    const technique = leafFixture();
    technique.requirements.push(conditionalRequirement());
    const input = makeReadyInput(technique);
    input.confirmedRequirementIds = input.confirmedRequirementIds.filter(
      (id) => id !== "fixture:conditional:biospecimen-permit",
    );
    const result = evaluateTechniqueReadiness({
      ...input,
      notApplicableRequirementIds: ["fixture:conditional:biospecimen-permit"],
    });
    assert.equal(result.status, "READY");
    const item = result.items.find(
      (entry) => entry.requirementId === "fixture:conditional:biospecimen-permit",
    );
    assert.equal(item?.state, "NOT_APPLICABLE");
  });
});

describe("evaluateTechniqueReadiness profile additionalRequirements", () => {
  it("merges profile additionalRequirements into the checked items", () => {
    const technique = leafFixture(PROFILE_CODE);
    assert.ok(technique.profiles.length > 0, `${PROFILE_CODE} fixture must declare profiles`);
    const profile = technique.profiles.find(
      (candidate) => candidate.additionalRequirements.length > 0,
    );
    assert.ok(profile, `${PROFILE_CODE} fixture must have a profile with additionalRequirements`);

    const withoutProfile = evaluateTechniqueReadiness(makeReadyInput(technique));
    const withProfile = evaluateTechniqueReadiness(makeReadyInput(technique, profile.code));

    const baseIds = new Set(withoutProfile.items.map((item) => item.requirementId));
    for (const requirement of profile.additionalRequirements) {
      assert.ok(
        !baseIds.has(requirement.id),
        `profile requirement ${requirement.id} must not appear without profileCode`,
      );
    }
    const mergedIds = new Set(withProfile.items.map((item) => item.requirementId));
    for (const requirement of technique.requirements) {
      assert.ok(mergedIds.has(requirement.id), `base requirement ${requirement.id} retained`);
    }
    for (const requirement of profile.additionalRequirements) {
      assert.ok(
        mergedIds.has(requirement.id),
        `profile requirement ${requirement.id} merged when profileCode=${profile.code}`,
      );
    }
    assert.equal(
      withProfile.items.length,
      technique.requirements.length + profile.additionalRequirements.length,
    );
    assert.equal(withProfile.profileCode, profile.code);
    assert.equal(
      withProfile.status,
      "READY",
      `fully satisfied profile check should be READY, got ${withProfile.status}: ${withProfile.reasons.join(" | ")}`,
    );
  });
});
