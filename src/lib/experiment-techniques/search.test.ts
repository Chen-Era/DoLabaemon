import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { describe, it } from "node:test";

import {
  repositoryCatalogValidation,
  repositoryTechniqueCatalog,
  repositoryTechniqueByCode,
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

describe("mainstream integrative-biology coverage", () => {
  const coverageBaseline = {
    targetedChromatin: [
      "CHIP_PCR",
      "CHIP_QPCR",
      "ATAC_QPCR",
      "CHIP_SEQUENCING",
      "CUT_AND_RUN",
      "CUT_AND_TAG",
      "ATAC_SEQUENCING",
      "DNASE_SEQUENCING",
    ],
    threeDimensionalGenomics: [
      "HI_C_CHROMOSOME_CONFORMATION_CAPTURE",
      "CAPTURE_HI_C",
      "FOUR_C_SEQUENCING",
    ],
    transcriptomeAndRnaBinding: [
      "BULK_POLY_A_RNA_SEQUENCING",
      "TOTAL_RNA_SEQUENCING",
      "LONG_READ_RNA_SEQUENCING",
      "RIBOSOME_PROFILING",
      "ECLIP_SEQUENCING",
      "RIP_SEQUENCING",
    ],
    singleCellAndPerturbation: [
      "DROPLET_SINGLE_CELL_RNA_SEQUENCING",
      "SINGLE_CELL_ATAC_SEQUENCING",
      "SINGLE_CELL_MULTIOME_RNA_ATAC_SEQUENCING",
      "CITE_SEQUENCING",
      "SINGLE_CELL_VDJ_SEQUENCING",
      "SINGLE_CELL_DNA_SEQUENCING",
      "POOLED_CRISPR_CAS9_SCREEN",
      "CRISPR_INTERFERENCE_SCREEN",
      "PERTURB_SEQUENCING",
    ],
    spatialBiology: [
      "CAPTURE_BASED_SPATIAL_TRANSCRIPTOMICS",
      "IMAGING_BASED_SPATIAL_TRANSCRIPTOMICS",
      "SPATIAL_PROTEOMICS",
    ],
    proteomeAndMetabolism: [
      "DDA_LC_MS_PROTEOMICS",
      "DIA_LC_MS_PROTEOMICS",
      "TMT_MULTIPLEXED_PROTEOMICS",
      "PHOSPHOPROTEOMICS",
      "UNTARGETED_LC_MS_METABOLOMICS",
      "TARGETED_LC_MS_METABOLOMICS",
      "STABLE_ISOTOPE_TRACING_METABOLOMICS",
      "METAPROTEOMICS",
    ],
  } as const;

  it("contains the methods needed for mainstream integrative-biology study designs", () => {
    for (const [domain, codes] of Object.entries(coverageBaseline)) {
      for (const code of codes) {
        assert.ok(
          repositoryTechniqueByCode.has(code),
          `${domain} must include ${code}`,
        );
      }
    }
  });

  it("models ChIP-qPCR with its chromatin-enrichment and qPCR reagents", () => {
    const technique = repositoryTechniqueByCode.get("CHIP_QPCR");
    assert.ok(technique, "CHIP_QPCR must be present in the catalog");
    const tags = new Set<string>(
      technique.requirements
        .filter((requirement) => requirement.kind === "REAGENT")
        .flatMap((requirement) => requirement.capabilityTags),
    );
    for (const tag of [
      "CHIP_GRADE_ANTIBODY",
      "PROTEIN_A_G_MAGNETIC_BEADS",
      "PCR_PRIMER_SET",
      "QPCR_MASTER_MIX",
    ] as const) {
      assert.ok(tags.has(tag), `CHIP_QPCR must require ${tag}`);
    }
  });

  it("uses non-sequencing reagent baselines for imaging and array modalities", () => {
    for (const code of [
      "IMAGING_BASED_SPATIAL_TRANSCRIPTOMICS",
      "SPATIAL_PROTEOMICS",
      "DNA_METHYLATION_ARRAY",
    ]) {
      const technique = repositoryTechniqueByCode.get(code);
      assert.ok(technique, `${code} must be present in the catalog`);
      const tags = new Set(
        technique.requirements
          .filter((requirement) => requirement.kind === "REAGENT")
          .flatMap((requirement) => requirement.capabilityTags),
      );
      assert.ok(
        !tags.has("SEQUENCING_RUN_REAGENT"),
        `${code} must not require a sequencing run by default`,
      );
      assert.ok(
        !tags.has("LIBRARY_PREPARATION_REAGENT"),
        `${code} must not require sequencing-library preparation by default`,
      );
    }
  });

  it("resolves hyphenated ChIP readout names directly to their catalog entries", () => {
    for (const [query, expectedCode] of [
      ["ChIP-PCR", "CHIP_PCR"],
      ["ChIP-qPCR", "CHIP_QPCR"],
    ]) {
      const { autoSelectedCode } = resolveTechniqueCandidates(
        repositoryTechniqueCatalog,
        query,
      );
      assert.equal(autoSelectedCode, expectedCode, `${query} must resolve directly`);
    }
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
