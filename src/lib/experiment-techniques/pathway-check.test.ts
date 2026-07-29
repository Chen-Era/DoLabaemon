import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { evaluateTechniqueReadiness } from "@/lib/experiment-techniques/check";
import { repositoryTechniqueByCode } from "@/lib/experiment-techniques/catalog";
import {
  getPathwayCheckContext,
  listPathwayCheckContexts,
} from "@/lib/experiment-techniques/pathway-check";

const epigeneticPathwayChecks = [
  ["WHOLE_GENOME_BISULFITE_SEQUENCING", "DNA_METHYLATION_HYDROXYMETHYLATION"],
  ["CHIP_QPCR", "HISTONE_ACETYLATION"],
  ["CHIP_QPCR", "HISTONE_METHYLATION"],
  ["WB", "HISTONE_LACTYLATION"],
  ["ATAC_QPCR", "CHROMATIN_ACCESSIBILITY_ARCHITECTURE"],
  ["PHOSPHOPROTEOMICS", "PROTEIN_PHOSPHORYLATION_KINASE_SIGNALING"],
] as const;

const flowImmunePathways = [
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
] as const;

describe("pathway-specific experiment checks", () => {
  it("exposes concrete rule-backed options for every added epigenetic/signaling topic", () => {
    for (const [techniqueCode, directionCode] of epigeneticPathwayChecks) {
      const context = getPathwayCheckContext(techniqueCode, directionCode);
      assert.ok(context, `${techniqueCode}/${directionCode} must expose a pathway check`);
      assert.ok(context.ruleCount > 0, `${directionCode} must include check rules`);
      assert.ok(
        listPathwayCheckContexts(techniqueCode).some((item) => item.code === directionCode),
        `${directionCode} must be included in ${techniqueCode} detail options`,
      );
    }
  });

  it("merges selected pathway rules into readiness results instead of silently ignoring them", () => {
    for (const [techniqueCode, directionCode] of epigeneticPathwayChecks) {
      const technique = repositoryTechniqueByCode.get(techniqueCode);
      assert.ok(technique, `${techniqueCode} must exist in the repository catalog`);

      const result = evaluateTechniqueReadiness({
        technique: structuredClone(technique),
        directionCode,
        inventory: [],
      });

      assert.equal(result.directionCode, directionCode);
      assert.equal(result.direction?.code, directionCode);
      const pathwayItems = result.items.filter((item) =>
        item.requirementId.startsWith(`direction:${directionCode}:${techniqueCode}:`),
      );
      assert.ok(pathwayItems.length > 0, `${directionCode} rules must appear in the result`);
      assert.ok(
        pathwayItems.some((item) => item.level === "REQUIRED" && item.state === "MISSING"),
        `${directionCode} should block when its required specialized reagent is absent`,
      );
    }
  });

  it("uses antibody target metadata for pathway-specific histone-mark matching", () => {
    const technique = repositoryTechniqueByCode.get("CHIP_QPCR");
    assert.ok(technique, "CHIP_QPCR must exist in the repository catalog");
    const result = evaluateTechniqueReadiness({
      technique: structuredClone(technique),
      directionCode: "HISTONE_ACETYLATION",
      inventory: [
        {
          id: "h3k27ac-primary",
          name: "H3K27ac ChIP-grade primary antibody",
          experimentTags: ["CHIP_GRADE_ANTIBODY"],
          antibodyMeta: { role: "PRIMARY", targetName: "H3K27ac" },
        },
      ],
    });

    const item = result.items.find((entry) =>
      entry.requirementId.startsWith("direction:HISTONE_ACETYLATION:CHIP_QPCR:"),
    );
    assert.equal(item?.state, "MATCHED");
    assert.equal(item?.matchedName, "H3K27ac ChIP-grade primary antibody");
  });

  it("exposes immunology topics for FLOW with an IMMUNE category and real rules", () => {
    const options = listPathwayCheckContexts("FLOW");
    for (const code of flowImmunePathways) {
      const option = options.find((item) => item.code === code);
      assert.ok(option, `FLOW must expose ${code}`);
      assert.equal(option.category, "IMMUNE");
      assert.ok(option.requiredRuleCount > 0, `${code} needs a required inventory rule`);
    }
  });

  it("keeps inflammasome checks available for its WB and cytokine-ELISA readouts", () => {
    for (const techniqueCode of ["WB", "SANDWICH_ELISA"] as const) {
      const context = getPathwayCheckContext(techniqueCode, "INFLAMMASOME");
      assert.ok(context, `${techniqueCode} must expose the INFLAMMASOME topic`);
      assert.equal(context.category, "IMMUNE");
      assert.ok(context.requiredRuleCount > 0);
    }
  });

  it("matches the selected T-cell FLOW topic against its specialised inventory tag", () => {
    const technique = repositoryTechniqueByCode.get("FLOW");
    assert.ok(technique, "FLOW must exist in the repository catalog");
    const result = evaluateTechniqueReadiness({
      technique: structuredClone(technique),
      directionCode: "T_CELL_ACTIVATION_EXHAUSTION",
      inventory: [
        {
          id: "cd3-cd4-cd8-flow-panel",
          name: "CD3/CD4/CD8 fluorescent antibody panel",
          experimentTags: ["T_CELL_LINEAGE_MARKER_REAGENT"],
        },
      ],
    });

    assert.equal(result.direction?.category, "IMMUNE");
    const tCellRule = result.items.find((item) =>
      item.requirementId.startsWith("direction:T_CELL_ACTIVATION_EXHAUSTION:FLOW:"),
    );
    assert.equal(tCellRule?.state, "MATCHED");
    assert.equal(tCellRule?.matchedName, "CD3/CD4/CD8 fluorescent antibody panel");
  });
});
