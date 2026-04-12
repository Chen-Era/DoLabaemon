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
});
