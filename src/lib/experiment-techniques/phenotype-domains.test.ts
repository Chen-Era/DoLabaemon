import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { repositoryTechniqueByCode } from "@/lib/experiment-techniques/catalog";
import {
  getPhenotypePathwayDomain,
  phenotypePathwayDomains,
  summarizePhenotypePathwayDomains,
  techniquePhenotypePathwayCodes,
} from "@/lib/experiment-techniques/phenotype-domains";

describe("phenotype/pathway research domains", () => {
  it("covers the core pathway topics with concrete targets, reagents, controls, and methods", () => {
    for (const [code, target] of [
      ["EXOSOME", "CD9"],
      ["AUTOPHAGY", "MAP1LC3B/LC3B"],
      ["ECM_REMODELING", "COL1A1"],
      ["MITOCHONDRIAL_METABOLISM", "PPARGC1A/PGC-1α"],
      ["TGF_BETA_SMAD_SIGNALING", "TGFB1"],
    ] as const) {
      const domain = getPhenotypePathwayDomain(code);
      assert.ok(domain, `${code} must be available as a phenotype/pathway topic`);
      assert.ok(domain.targetPanel.mechanistic.includes(target));
      assert.ok(domain.targetPanel.controls.length > 0, `${code} must state controls`);
      assert.ok(domain.reagentRequirements.some((item) => item.level === "REQUIRED"));
      assert.ok(domain.techniqueCodes.length > 0, `${code} must link to methods`);
    }
  });

  it("adds broad, reusable pathway topics instead of the removed narrow IFN topic", () => {
    const expected = [
      "TGF_BETA_SMAD_SIGNALING",
      "WNT_BETA_CATENIN_SIGNALING",
      "PI3K_AKT_MTOR_SIGNALING",
      "MAPK_ERK_SIGNALING",
      "NF_KAPPA_B_INFLAMMATION",
      "CALCIUM_SIGNALING",
      "GLUCOSE_METABOLISM",
      "LIPID_METABOLISM",
      "FERROPTOSIS",
      "NECROPTOSIS",
      "LYSOSOMAL_FUNCTION",
      "CELL_ADHESION_CYTOSKELETON",
      "CIRCADIAN_RHYTHM",
      "EPIGENETIC_REPROGRAMMING",
      "DNA_METHYLATION_HYDROXYMETHYLATION",
      "HISTONE_ACETYLATION",
      "HISTONE_METHYLATION",
      "HISTONE_LACTYLATION",
      "CHROMATIN_ACCESSIBILITY_ARCHITECTURE",
      "PROTEIN_PHOSPHORYLATION_KINASE_SIGNALING",
      "NOTCH_HEDGEHOG_SIGNALING",
    ];

    assert.equal(getPhenotypePathwayDomain("INTERFERON_RESPONSE"), null);
    for (const code of expected) {
      const domain = getPhenotypePathwayDomain(code);
      assert.ok(domain, `missing expanded pathway topic ${code}`);
      assert.ok(domain.targetPanel.mechanistic.length > 0);
      assert.ok(domain.targetPanel.readout.length > 0);
      assert.ok(domain.targetPanel.controls.length > 0);
      assert.ok(domain.reagentRequirements.length >= 2);
    }
  });

  it("splits immune work into independently selectable and controlled topics", () => {
    const immuneDomains = phenotypePathwayDomains.filter(
      (domain) => domain.category === "IMMUNE",
    );
    const expected = [
      "INFLAMMASOME",
      "T_CELL_ACTIVATION_EXHAUSTION",
      "B_CELL_HUMORAL_IMMUNITY",
      "NK_CELL_CYTOTOXICITY",
      "MYELOID_INNATE_IMMUNITY",
      "CHECKPOINT_IMMUNITY",
      "IMMUNE_METABOLISM",
      "ANTIGEN_PRESENTATION",
      "COMPLEMENT_FC_EFFECTOR",
      "IMMUNE_TRAFFICKING",
    ];

    assert.ok(immuneDomains.length >= expected.length);
    for (const code of expected) {
      const domain = getPhenotypePathwayDomain(code);
      assert.ok(domain, `missing immune topic ${code}`);
      assert.equal(domain.category, "IMMUNE");
      assert.ok(domain.targetPanel.readout.length > 0, `${code} must define a readout`);
      assert.ok(domain.targetPanel.controls.length > 0, `${code} must define exclusion/controls`);
      assert.ok(
        domain.reagentRequirements.some((requirement) => requirement.role.zh.includes("对照")),
        `${code} must contain a dedicated control reagent requirement`,
      );
    }
  });

  it("only links published catalog techniques and supports reverse lookup/summaries", () => {
    for (const domain of phenotypePathwayDomains) {
      for (const techniqueCode of domain.techniqueCodes) {
        assert.ok(
          repositoryTechniqueByCode.has(techniqueCode),
          `${domain.code} references unknown technique ${techniqueCode}`,
        );
      }
    }

    assert.ok(techniquePhenotypePathwayCodes("WB").includes("EXOSOME"));
    assert.ok(techniquePhenotypePathwayCodes("WB").includes("AUTOPHAGY"));
    assert.ok(techniquePhenotypePathwayCodes("FLOW").includes("T_CELL_ACTIVATION_EXHAUSTION"));

    const summaries = summarizePhenotypePathwayDomains(repositoryTechniqueByCode.keys());
    assert.equal(summaries.length, phenotypePathwayDomains.length);
    assert.ok(summaries.every((domain) => domain.techniqueCount > 0));
  });
});
