import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildTechniqueCatalogDigest,
  normalizeAiMatchResponse,
} from "@/lib/experiment-techniques/ai-match";
import { repositoryTechniqueCatalog } from "@/lib/experiment-techniques/catalog";
import type { ExperimentTechnique } from "@/lib/experiment-techniques/types";

const wb = repositoryTechniqueCatalog.find((technique) => technique.code === "WB");
const rtqpcr = repositoryTechniqueCatalog.find((technique) => technique.code === "RT_QPCR");

assert.ok(wb, "fixture expects WB in the repository catalog");
assert.ok(rtqpcr, "fixture expects RT_QPCR in the repository catalog");

function makeVariant(overrides: Partial<ExperimentTechnique>): ExperimentTechnique {
  return { ...(wb as ExperimentTechnique), ...overrides };
}

describe("buildTechniqueCatalogDigest", () => {
  it("emits one pipe-separated line per technique with code, names and aliases", () => {
    const digest = buildTechniqueCatalogDigest([wb!, rtqpcr!]);
    const lines = digest.split("\n");
    assert.equal(lines.length, 2);
    assert.match(lines[0], /^WB \| /);
    assert.ok(lines[0].includes(wb!.name.zh));
    assert.ok(lines[0].includes(wb!.name.en));
    assert.ok(lines[0].includes(wb!.categoryCode));
    assert.match(lines[1], /^RT_QPCR \| /);
  });
});

describe("normalizeAiMatchResponse", () => {
  const techniques = [wb!, rtqpcr!];

  it("keeps valid codes sorted by confidence with rationale", () => {
    const result = normalizeAiMatchResponse(
      {
        matches: [
          { code: "RT_QPCR", confidence: 0.61, rationale: "转录水平定量" },
          { code: "WB", confidence: 0.93, rationale: "用户提到蛋白免疫印迹" },
        ],
        notes: "两个方向都可能",
      },
      techniques,
      5,
    );
    assert.equal(result.candidates.length, 2);
    assert.equal(result.candidates[0].code, "WB");
    assert.equal(result.candidates[0].confidence, 0.93);
    assert.equal(result.candidates[0].rationale, "用户提到蛋白免疫印迹");
    assert.equal(result.candidates[0].technique.code, "WB");
    assert.equal(result.candidates[1].code, "RT_QPCR");
    assert.equal(result.notes, "两个方向都可能");
  });

  it("drops invented codes that do not exist in the catalog", () => {
    const result = normalizeAiMatchResponse(
      {
        matches: [
          { code: "WB_PREMIUM", confidence: 0.99, rationale: "幻觉 code" },
          { code: "WB", confidence: 0.8, rationale: "真实 code" },
        ],
      },
      techniques,
      5,
    );
    assert.deepEqual(
      result.candidates.map((candidate) => candidate.code),
      ["WB"],
    );
  });

  it("drops abstract and non-published techniques", () => {
    const abstract = makeVariant({ code: "PARENT_CATEGORY", isAbstract: true });
    const draft = makeVariant({ code: "DRAFT_ONLY", status: "DRAFT" });
    const result = normalizeAiMatchResponse(
      {
        matches: [
          { code: "PARENT_CATEGORY", confidence: 0.9, rationale: "抽象分类" },
          { code: "DRAFT_ONLY", confidence: 0.9, rationale: "未发布" },
          { code: "WB", confidence: 0.7, rationale: "可选" },
        ],
      },
      [abstract, draft, wb!],
      5,
    );
    assert.deepEqual(
      result.candidates.map((candidate) => candidate.code),
      ["WB"],
    );
  });

  it("dedupes repeated codes and caps at the limit", () => {
    const result = normalizeAiMatchResponse(
      {
        matches: [
          { code: "WB", confidence: 0.9, rationale: "第一次" },
          { code: "RT_QPCR", confidence: 0.85, rationale: "" },
          { code: "WB", confidence: 0.5, rationale: "重复" },
        ],
      },
      techniques,
      1,
    );
    assert.deepEqual(
      result.candidates.map((candidate) => candidate.code),
      ["WB"],
    );
  });

  it("accepts bare string matches and 0-100 confidence scales", () => {
    const result = normalizeAiMatchResponse(
      { matches: ["WB", { code: "RT_QPCR", confidence: 62, rationale: "" }] },
      techniques,
      5,
    );
    assert.deepEqual(
      result.candidates.map((candidate) => [candidate.code, candidate.confidence]),
      [
        ["RT_QPCR", 0.62],
        ["WB", 0.5],
      ],
    );
  });

  it("returns an empty result for malformed payloads instead of throwing", () => {
    for (const payload of [null, undefined, {}, { matches: "WB" }, { matches: [42] }]) {
      const result = normalizeAiMatchResponse(payload, techniques, 5);
      assert.deepEqual(result, { candidates: [], notes: null });
    }
  });

  it("normalizes empty notes to null", () => {
    const result = normalizeAiMatchResponse(
      { matches: [{ code: "WB", confidence: 0.9, rationale: "" }], notes: "   " },
      techniques,
      5,
    );
    assert.equal(result.notes, null);
  });
});
