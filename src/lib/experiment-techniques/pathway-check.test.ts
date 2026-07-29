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
});
