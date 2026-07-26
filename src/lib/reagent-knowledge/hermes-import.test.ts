import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  importHermesKnowledge,
  normalizeHermesEntryId,
  parseHermesKnowledgeLine,
} from "@/lib/reagent-knowledge/hermes-import";

const validEntry = {
  id: "hermes-trizol-rna-extraction",
  canonicalName: "TRIzol",
  aliases: ["TRIzol", "Trizol", "TRI Reagent"],
  category: "CHEMICAL",
  subCategory: "RNA Extraction Reagent",
  experimentTags: ["RNA_EXTRACTION_REAGENT"],
  namePatterns: ["\\b(trizol|tri\\s*reagent)\\b"],
  requiredKeywords: [],
  excludedKeywords: ["dna extraction"],
  vendorHints: ["Invitrogen"],
  evidenceType: "exact_alias",
  confidenceHint: 0.93,
  notes: "酚-胍法总 RNA 提取试剂",
};

function lineOf(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({ ...validEntry, ...overrides });
}

test("parseHermesKnowledgeLine accepts a valid line and preserves fields", () => {
  const result = parseHermesKnowledgeLine(lineOf());

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.entry.id, "hermes-trizol-rna-extraction");
  assert.equal(result.entry.canonicalName, "TRIzol");
  assert.equal(result.entry.category, "CHEMICAL");
  assert.deepEqual(result.entry.experimentTags, ["RNA_EXTRACTION_REAGENT"]);
  assert.equal(result.entry.evidenceType, "exact_alias");
  assert.equal(result.entry.confidenceHint, 0.93);
  assert.equal(result.entry.notes, "酚-胍法总 RNA 提取试剂");
});

test("parseHermesKnowledgeLine rejects invalid category enum values", () => {
  const result = parseHermesKnowledgeLine(lineOf({ category: "PROTEIN" }));

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /category/);
});

test("parseHermesKnowledgeLine rejects invalid experimentTags enum values", () => {
  const result = parseHermesKnowledgeLine(lineOf({ experimentTags: ["WB_MAGIC_REAGENT"] }));

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /experimentTags/);
});

test("parseHermesKnowledgeLine rejects invalid evidenceType and out-of-range confidenceHint", () => {
  const badEvidence = parseHermesKnowledgeLine(lineOf({ evidenceType: "guess" }));
  const badConfidence = parseHermesKnowledgeLine(lineOf({ confidenceHint: 1.2 }));

  assert.equal(badEvidence.ok, false);
  assert.equal(badConfidence.ok, false);
});

test("parseHermesKnowledgeLine rejects namePatterns that do not compile", () => {
  const result = parseHermesKnowledgeLine(lineOf({ namePatterns: ["\\b(trizol\\b", "[a-z"] }));

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /namePatterns/);
});

test("parseHermesKnowledgeLine rejects lines that are not valid JSON", () => {
  const result = parseHermesKnowledgeLine("{not json}");

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /JSON/);
});

test("normalizeHermesEntryId adds the hermes- prefix after slug normalization", () => {
  assert.equal(normalizeHermesEntryId("Trizol Reagent"), "hermes-trizol-reagent");
  assert.equal(normalizeHermesEntryId("hermes-ecl substrate"), "hermes-ecl-substrate");
  assert.equal(normalizeHermesEntryId("hermes-already-good-1"), "hermes-already-good-1");
  assert.equal(normalizeHermesEntryId("---"), null);
});

test("parseHermesKnowledgeLine prefixes ids that lack hermes-", () => {
  const result = parseHermesKnowledgeLine(lineOf({ id: "ECL Substrate" }));

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.entry.id, "hermes-ecl-substrate");
});

test("importHermesKnowledge reports mixed-line statistics with 1-based line numbers", () => {
  const jsonl = [
    lineOf(),
    "",
    lineOf({ id: "ECL Substrate", canonicalName: "ECL Substrate" }),
    "{not json}",
    lineOf({ id: "bad-category", category: "PROTEIN" }),
    lineOf({ id: "bad-pattern", namePatterns: ["\\b(ecl\\b"] }),
  ].join("\n");

  const result = importHermesKnowledge(jsonl);

  assert.equal(result.imported.length, 2);
  assert.equal(result.rejected.length, 3);
  assert.deepEqual(
    result.rejected.map((item) => item.line),
    [4, 5, 6],
  );
  assert.equal(result.imported[0].id, "hermes-trizol-rna-extraction");
  assert.equal(result.imported[1].id, "hermes-ecl-substrate");
});

test("importHermesKnowledge skips trailing blank lines without rejecting them", () => {
  const result = importHermesKnowledge(`${lineOf()}\n\n`);

  assert.equal(result.imported.length, 1);
  assert.equal(result.rejected.length, 0);
});

test("every line of integrations/hermes/output/sample-knowledge.jsonl parses cleanly", () => {
  const samplePath = fileURLToPath(
    new URL("../../../integrations/hermes/output/sample-knowledge.jsonl", import.meta.url),
  );
  const jsonl = readFileSync(samplePath, "utf8");

  const result = importHermesKnowledge(jsonl);

  assert.deepEqual(result.rejected, []);
  assert.equal(result.imported.length, 2);
  assert.ok(result.imported.every((entry) => entry.id.startsWith("hermes-")));
});
