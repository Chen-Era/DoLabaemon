import test from "node:test";
import assert from "node:assert/strict";
import { extractBatchRows } from "@/lib/reagent-ingest/extract-batch-rows";

test("extractBatchRows parses tabular reagent text", async () => {
  const rows = await extractBatchRows(
    [
      "名称\t厂家\t货号\t备注",
      "Rabbit anti-LC3B\tCST\t2775S\tWB 1:1000",
      "Goat anti-rabbit IgG Alexa 488\tInvitrogen\tA-11008\tIF secondary",
    ].join("\n"),
    "zh",
    { allowLlm: false },
  );

  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], {
    sourceText: "Rabbit anti-LC3B\tCST\t2775S\tWB 1:1000",
    name: "Rabbit anti-LC3B",
    vendor: "CST",
    catalogNo: "2775S",
    note: "WB 1:1000",
    antibodyCompatibilityText: "WB 1:1000",
  });
  assert.equal(rows[1].catalogNo, "A-11008");
});

test("extractBatchRows maps columns by header instead of fixed order", async () => {
  const rows = await extractBatchRows(
    [
      "货号\t供应商\t产品名称\t适用种属\t备注",
      "2775S\tCST\tRabbit anti-LC3B\tHuman, Mouse\tWB 1:1000",
    ].join("\n"),
    "zh",
    { allowLlm: false },
  );

  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], {
    sourceText: "2775S\tCST\tRabbit anti-LC3B\tHuman, Mouse\tWB 1:1000",
    name: "Rabbit anti-LC3B",
    vendor: "CST",
    catalogNo: "2775S",
    note: "WB 1:1000",
    antibodyCompatibilityText: "Human, Mouse",
  });
});

test("extractBatchRows falls back to one row per line when llm is disabled", async () => {
  const rows = await extractBatchRows(["DMEM", "FBS", "Puromycin"].join("\n"), "zh", { allowLlm: false });

  assert.equal(rows.length, 3);
  assert.equal(rows[0].name, "DMEM");
  assert.equal(rows[1].name, "FBS");
  assert.equal(rows[2].name, "Puromycin");
});

test("extractBatchRows supplements missing vendor and catalog from search evidence", async () => {
  const rows = await extractBatchRows("Recombinant human BMP2 protein", "zh", {
    allowLlm: false,
    searchWeb: async () => [
      {
        title: "Abcam recombinant human BMP2 protein ab12345",
        url: "https://www.abcam.com/ab12345",
        snippet: "Abcam product page",
        domain: "www.abcam.com",
      },
    ],
    fetchPages: async () => [
      {
        title: "Abcam recombinant human BMP2 protein ab12345",
        url: "https://www.abcam.com/ab12345",
        domain: "www.abcam.com",
        snippet: "Abcam product page",
        excerpt: "Recombinant human BMP2 protein catalog ab12345 from Abcam.",
      },
    ],
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].vendor, "Abcam");
  assert.equal(rows[0].catalogNo, "ab12345");
  assert.equal(rows[0].supplementation?.searchStatus, "filled_from_search");
  assert.equal(rows[0].supplementation?.catalogInferred, true);
});

test("extractBatchRows limits search supplementation concurrency", async () => {
  let active = 0;
  let maxActive = 0;

  const rows = await extractBatchRows(["A", "B", "C", "D", "E"].join("\n"), "zh", {
    allowLlm: false,
    searchWeb: async (query) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 10));
      active -= 1;
      return [
        {
          title: `${query} result`,
          url: "https://example.com/product",
          snippet: "no catalog here",
          domain: "example.com",
        },
      ];
    },
    fetchPages: async () => [],
  });

  assert.equal(rows.length, 5);
  assert.equal(maxActive, 3);
});

test("extractBatchRows records search request failures for later diagnostics", async () => {
  const rows = await extractBatchRows("LC3B antibody", "zh", {
    allowLlm: false,
    searchWeb: async () => {
      throw new Error("SEARCH_DOWN");
    },
    fetchPages: async () => [],
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].supplementation?.searchStatus, "request_failed");
});
