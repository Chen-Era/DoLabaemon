import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { repositoryTechniqueByCode } from "@/lib/experiment-techniques/catalog";
import * as runtime from "@/lib/experiment-techniques/runtime";
import type { ExperimentTechnique } from "@/lib/experiment-techniques/types";

// Contract under test (implemented in parallel in runtime.ts):
//   type TechniqueOverlayEntry =
//     | { kind: "technique"; technique: ExperimentTechnique }
//     | { kind: "shadow"; code: string }
//     | { kind: "invalid"; code: string | null; issues: string };
//   mergeTechniqueCatalogsWithReport(baseline, overlay) =>
//     { techniques: ExperimentTechnique[]; warnings: string[]; shadowedCodes: string[] }
type TechniqueOverlayEntry =
  | { kind: "technique"; technique: ExperimentTechnique }
  | { kind: "shadow"; code: string }
  | { kind: "invalid"; code: string | null; issues: string };

type MergeWithReport = (
  baseline: ExperimentTechnique[],
  overlay: TechniqueOverlayEntry[],
) => {
  techniques: ExperimentTechnique[];
  warnings: string[];
  shadowedCodes: string[];
};

const mergeWithReport = (
  runtime as unknown as { mergeTechniqueCatalogsWithReport?: MergeWithReport }
).mergeTechniqueCatalogsWithReport;

const BASE_CODE = "SANDWICH_ELISA";
const BASE_REVISION = 10;

function cloneLeaf(overrides: Partial<ExperimentTechnique> = {}): ExperimentTechnique {
  const technique = repositoryTechniqueByCode.get(BASE_CODE);
  assert.ok(technique, `repository catalog must contain ${BASE_CODE}`);
  const clone = structuredClone(technique);
  Object.assign(clone, overrides);
  return clone;
}

function baselineFixture(): ExperimentTechnique {
  return cloneLeaf({
    revision: BASE_REVISION,
    source: "SYSTEM",
    status: "PUBLISHED",
    name: { zh: "基线名称", en: "Baseline marker name" },
  });
}

function overlayTechnique(overrides: Partial<ExperimentTechnique>): ExperimentTechnique {
  return cloneLeaf({
    name: { zh: "覆盖层名称", en: "Overlay marker name" },
    ...overrides,
  });
}

function techniqueOverlay(technique: ExperimentTechnique): TechniqueOverlayEntry {
  return { kind: "technique", technique };
}

function requireMergeWithReport(): MergeWithReport {
  if (typeof mergeWithReport !== "function") {
    assert.fail(
      "mergeTechniqueCatalogsWithReport is not exported from runtime.ts yet (implementation pending)",
    );
  }
  return mergeWithReport;
}

function findByCode(techniques: ExperimentTechnique[], code: string) {
  return techniques.find((technique) => technique.code === code);
}

describe("mergeTechniqueCatalogsWithReport revision/source arbitration", () => {
  void it("lets a SYSTEM overlay win when its revision is greater than the baseline", () => {
    const merge = requireMergeWithReport();
    const baseline = baselineFixture();
    const overlay = overlayTechnique({
      revision: BASE_REVISION + 1,
      source: "SYSTEM",
      status: "PUBLISHED",
    });
    const result = merge([baseline], [techniqueOverlay(overlay)]);
    assert.equal(findByCode(result.techniques, BASE_CODE)?.name.en, "Overlay marker name");
    assert.equal(findByCode(result.techniques, BASE_CODE)?.revision, BASE_REVISION + 1);
  });

  void it("keeps the baseline when a SYSTEM overlay has equal revision", () => {
    const merge = requireMergeWithReport();
    const baseline = baselineFixture();
    const overlay = overlayTechnique({
      revision: BASE_REVISION,
      source: "SYSTEM",
      status: "PUBLISHED",
    });
    const result = merge([baseline], [techniqueOverlay(overlay)]);
    assert.equal(findByCode(result.techniques, BASE_CODE)?.name.en, "Baseline marker name");
  });

  void it("keeps the baseline when a SYSTEM overlay has a lower revision", () => {
    const merge = requireMergeWithReport();
    const baseline = baselineFixture();
    const overlay = overlayTechnique({
      revision: BASE_REVISION - 1,
      source: "SYSTEM",
      status: "PUBLISHED",
    });
    const result = merge([baseline], [techniqueOverlay(overlay)]);
    assert.equal(findByCode(result.techniques, BASE_CODE)?.name.en, "Baseline marker name");
  });

  void it("lets a CURATED overlay win when its revision equals the baseline", () => {
    const merge = requireMergeWithReport();
    const baseline = baselineFixture();
    const overlay = overlayTechnique({
      revision: BASE_REVISION,
      source: "CURATED",
      status: "PUBLISHED",
    });
    const result = merge([baseline], [techniqueOverlay(overlay)]);
    assert.equal(findByCode(result.techniques, BASE_CODE)?.name.en, "Overlay marker name");
  });

  void it("lets a CURATED overlay win when its revision is greater than the baseline", () => {
    const merge = requireMergeWithReport();
    const baseline = baselineFixture();
    const overlay = overlayTechnique({
      revision: BASE_REVISION + 1,
      source: "CURATED",
      status: "PUBLISHED",
    });
    const result = merge([baseline], [techniqueOverlay(overlay)]);
    assert.equal(findByCode(result.techniques, BASE_CODE)?.name.en, "Overlay marker name");
  });

  void it("keeps the baseline when a CURATED overlay has a lower revision", () => {
    const merge = requireMergeWithReport();
    const baseline = baselineFixture();
    const overlay = overlayTechnique({
      revision: BASE_REVISION - 1,
      source: "CURATED",
      status: "PUBLISHED",
    });
    const result = merge([baseline], [techniqueOverlay(overlay)]);
    assert.equal(findByCode(result.techniques, BASE_CODE)?.name.en, "Baseline marker name");
  });
});

describe("mergeTechniqueCatalogsWithReport overlay entry kinds", () => {
  void it("includes a PUBLISHED overlay technique whose code is absent from the baseline", () => {
    const merge = requireMergeWithReport();
    const baseline = baselineFixture();
    const novel = overlayTechnique({
      id: "curated:ZZZ_RUNTIME_OVERLAY_ONLY",
      code: "ZZZ_RUNTIME_OVERLAY_ONLY",
      slug: "zzz-runtime-overlay-only",
      revision: 1,
      source: "CURATED",
      status: "PUBLISHED",
    });
    const result = merge([baseline], [techniqueOverlay(novel)]);
    const merged = findByCode(result.techniques, "ZZZ_RUNTIME_OVERLAY_ONLY");
    assert.ok(merged, "novel overlay code must be present in the merged catalog");
    assert.equal(merged?.name.en, "Overlay marker name");
    assert.ok(findByCode(result.techniques, BASE_CODE), "baseline entry must be retained");
  });

  void it("removes a shadowed code from the result and reports it in shadowedCodes", () => {
    const merge = requireMergeWithReport();
    const baseline = baselineFixture();
    const result = merge([baseline], [{ kind: "shadow", code: BASE_CODE }]);
    assert.equal(
      findByCode(result.techniques, BASE_CODE),
      undefined,
      "shadowed code must disappear from the merged catalog",
    );
    assert.ok(
      result.shadowedCodes.includes(BASE_CODE),
      `shadowedCodes must include ${BASE_CODE}, got ${JSON.stringify(result.shadowedCodes)}`,
    );
  });

  void it("keeps the baseline entry and emits warnings for invalid overlay entries", () => {
    const merge = requireMergeWithReport();
    const baseline = baselineFixture();
    const result = merge(
      [baseline],
      [{ kind: "invalid", code: BASE_CODE, issues: "schema: name.zh is empty" }],
    );
    assert.ok(
      result.warnings.length > 0,
      "invalid overlay entries must produce at least one warning",
    );
    assert.equal(
      findByCode(result.techniques, BASE_CODE)?.name.en,
      "Baseline marker name",
      "baseline entry must survive an invalid overlay entry",
    );
  });
});

describe("mergeTechniqueCatalogs legacy signature", () => {
  void it("lets a DEPRECATED database entry shadow the baseline publication", () => {
    const baseline = baselineFixture();
    const deprecated = overlayTechnique({
      revision: BASE_REVISION + 1,
      source: "CURATED",
      status: "DEPRECATED",
    });
    const merged = runtime.mergeTechniqueCatalogs([baseline], [deprecated]);
    const stillPublished = merged.filter(
      (technique) => technique.code === BASE_CODE && technique.status === "PUBLISHED",
    );
    assert.deepEqual(
      stillPublished,
      [],
      "a DEPRECATED database entry must shadow the baseline so no PUBLISHED entry remains",
    );
  });

  void it("lets a higher-revision SYSTEM database entry override the baseline", () => {
    const baseline = baselineFixture();
    const newer = overlayTechnique({
      revision: BASE_REVISION + 1,
      source: "SYSTEM",
      status: "PUBLISHED",
    });
    const merged = runtime.mergeTechniqueCatalogs([baseline], [newer]);
    assert.equal(findByCode(merged, BASE_CODE)?.name.en, "Overlay marker name");
    assert.equal(findByCode(merged, BASE_CODE)?.revision, BASE_REVISION + 1);
  });
});
