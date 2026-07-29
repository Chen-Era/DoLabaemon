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
      ["INTERFERON_RESPONSE", "IFNAR1"],
    ] as const) {
      const domain = getPhenotypePathwayDomain(code);
      assert.ok(domain, `${code} must be available as a phenotype/pathway topic`);
      assert.ok(domain.targetPanel.mechanistic.includes(target));
      assert.ok(domain.targetPanel.controls.length > 0, `${code} must state controls`);
      assert.ok(domain.reagentRequirements.some((item) => item.level === "REQUIRED"));
      assert.ok(domain.techniqueCodes.length > 0, `${code} must link to methods`);
    }
  });

  it("splits immune work into independently selectable and controlled topics", () => {
    const immuneDomains = phenotypePathwayDomains.filter(
      (domain) => domain.category === "IMMUNE",
    );
    const expected = [
      "INTERFERON_RESPONSE",
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
