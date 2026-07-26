import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { describe, it } from "node:test";

import {
  repositoryCatalogValidation,
  repositoryTechniqueCatalog,
} from "@/lib/experiment-techniques/catalog";
import {
  createTechniqueSearchIndex,
  resolveTechniqueCandidates,
} from "@/lib/experiment-techniques/search";
import type { ExperimentTechnique } from "@/lib/experiment-techniques/types";

describe("repository catalog acceptance gate", () => {
  it("passes catalog validation with zero errors and zero warnings", () => {
    assert.deepEqual(
      {
        valid: repositoryCatalogValidation.valid,
        errors: repositoryCatalogValidation.errors,
        warnings: repositoryCatalogValidation.warnings,
      },
      { valid: true, errors: [], warnings: [] },
      [
        "repository catalog validation must be green.",
        `first errors: ${repositoryCatalogValidation.errors.slice(0, 5).join(" || ")}`,
        `first warnings: ${repositoryCatalogValidation.warnings.slice(0, 5).join(" || ")}`,
      ].join("\n"),
    );
  });
});

describe("resolution golden set", () => {
  for (const technique of repositoryTechniqueCatalog) {
    void describe(`${technique.code}`, () => {
      for (const example of technique.resolutionExamples.positive) {
        void it(`positive: "${example.query}" resolves to ${example.expectedCode}`, () => {
          const { autoSelectedCode } = resolveTechniqueCandidates(
            repositoryTechniqueCatalog,
            example.query,
          );
          assert.equal(
            autoSelectedCode,
            example.expectedCode,
            [
              `query: ${example.query}`,
              `expected autoSelectedCode: ${example.expectedCode}`,
              `actual autoSelectedCode: ${autoSelectedCode}`,
              `context: ${example.context}`,
              `reason: ${example.reason}`,
            ].join("\n"),
          );
        });
      }
      for (const example of technique.resolutionExamples.negative) {
        void it(`negative: "${example.query}" must not resolve to ${example.excludedCode}`, () => {
          const { autoSelectedCode } = resolveTechniqueCandidates(
            repositoryTechniqueCatalog,
            example.query,
          );
          assert.notEqual(
            autoSelectedCode,
            example.excludedCode,
            [
              `query: ${example.query}`,
              `excludedCode: ${example.excludedCode} (null or any other code is acceptable)`,
              `actual autoSelectedCode: ${autoSelectedCode}`,
              `context: ${example.context}`,
              `reason: ${example.reason}`,
            ].join("\n"),
          );
        });
      }
    });
  }
});

const leafTechniques = repositoryTechniqueCatalog.filter(
  (technique) => !technique.isAbstract,
);

function cloneTechniqueWithSuffix(
  base: ExperimentTechnique,
  index: number,
): ExperimentTechnique {
  const clone = structuredClone(base);
  clone.id = `${base.id}:perf-v${index}`;
  clone.code = `${base.code}_V${index}`;
  clone.slug = `${base.slug}-v${index}`;
  clone.name = {
    zh: `${base.name.zh}变体${index}`,
    en: `${base.name.en} variant ${index}`,
  };
  clone.aliases = base.aliases.map((alias) => `${alias} ${index}`);
  return clone;
}

function buildScaledCatalog(size: number): ExperimentTechnique[] {
  return Array.from({ length: size }, (_, index) =>
    cloneTechniqueWithSuffix(leafTechniques[index % leafTechniques.length], index),
  );
}

type MixedQuery = { kind: "exact-code" | "exact-name" | "token-phrase"; query: string };

function buildMixedQueries(catalog: ExperimentTechnique[], total = 200): MixedQuery[] {
  const queries: MixedQuery[] = [];
  const perKind = Math.floor(total / 3);
  for (let i = 0; i < perKind; i += 1) {
    const technique = catalog[(i * 7) % catalog.length];
    queries.push({ kind: "exact-code", query: technique.code });
  }
  for (let i = 0; i < perKind; i += 1) {
    const technique = catalog[(i * 11 + 3) % catalog.length];
    queries.push({ kind: "exact-name", query: technique.name.en });
  }
  for (let i = 0; i < perKind; i += 1) {
    const technique = catalog[(i * 13 + 5) % catalog.length];
    // Reorder the English name tokens so every token is present but the
    // compact query is not an exact name hit: this exercises the token path.
    const nameTokens = technique.name.en.split(/\s+/);
    const reordered = [...nameTokens.slice(1), nameTokens[0]].join(" ");
    queries.push({ kind: "token-phrase", query: reordered });
  }
  return queries;
}

function measureP95(catalog: ExperimentTechnique[], queries: MixedQuery[]) {
  const index = createTechniqueSearchIndex(catalog);
  // Warm up so JIT compilation does not pollute the first samples.
  for (const { query } of queries.slice(0, 20)) {
    index.search(query);
  }
  const durations: number[] = [];
  let matched = 0;
  for (const { query } of queries) {
    const start = performance.now();
    const results = index.search(query);
    durations.push(performance.now() - start);
    matched += results.length;
  }
  assert.ok(matched > 0, "perf queries should produce matches");
  const sorted = [...durations].sort((left, right) => left - right);
  return {
    p95: sorted[Math.ceil(sorted.length * 0.95) - 1],
    max: sorted[sorted.length - 1],
    queryCount: queries.length,
  };
}

describe("technique search performance", () => {
  void it("resolves an exact code against a 1000-entry cloned catalog", () => {
    const catalog = buildScaledCatalog(1000);
    const target = catalog[517];
    const { autoSelectedCode, candidates } = resolveTechniqueCandidates(
      catalog,
      target.code,
    );
    assert.equal(autoSelectedCode, target.code);
    assert.ok(candidates.length > 0);
  });

  void it("keeps p95 query latency under 5ms on a 1000-entry index", () => {
    const catalog = buildScaledCatalog(1000);
    const queries = buildMixedQueries(catalog);
    const { p95, max, queryCount } = measureP95(catalog, queries);
    assert.ok(
      p95 < 5,
      `1000-entry index p95 ${p95.toFixed(3)}ms (max ${max.toFixed(3)}ms, ${queryCount} queries) must be < 5ms`,
    );
  });

  void it("keeps p95 query latency under 15ms on a 5000-entry index", () => {
    const catalog = buildScaledCatalog(5000);
    const queries = buildMixedQueries(catalog);
    const { p95, max, queryCount } = measureP95(catalog, queries);
    assert.ok(
      p95 < 15,
      `5000-entry index p95 ${p95.toFixed(3)}ms (max ${max.toFixed(3)}ms, ${queryCount} queries) must be < 15ms`,
    );
  });
});
