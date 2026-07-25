import test from "node:test";
import assert from "node:assert/strict";
import {
  coerceReagentBatchExtractRows,
  coerceReagentParsedPayload,
  coerceVerifiedReagentPayload,
  normalizeLlmParsedPayload,
} from "@/lib/llm/normalize";
import { reagentBatchExtractSchema, reagentParsedSchema, verifiedReagentParsedSchema } from "@/lib/llm/schemas";

test("normalizeLlmParsedPayload converts blank strings into nullable fields", () => {
  const normalized = normalizeLlmParsedPayload({
    category: "BIOLOGICAL",
    subCategory: "Recombinant Protein",
    vendor: "",
    confidence: 0.95,
    warnings: [],
    experimentTags: [],
    antibodyMeta: {
      role: "",
      hostSpecies: "",
      targetSpecies: "",
      targetName: "",
    },
    primerMeta: {
      targetName: "",
      isReferenceGene: false,
    },
  });

  const parsed = reagentParsedSchema.parse(normalized);
  assert.equal(parsed.vendor, null);
  assert.equal(parsed.antibodyMeta, null);
  assert.deepEqual(parsed.primerMeta, { targetName: null, isReferenceGene: false });
});

test("coerceReagentParsedPayload normalizes 0-100 confidence and records a warning", () => {
  const coerced = coerceReagentParsedPayload({
    category: "BIOLOGICAL",
    confidence: 92,
    experimentTags: [],
  });
  const parsed = reagentParsedSchema.parse(coerced.payload);
  assert.equal(parsed.confidence, 0.92);
  assert.ok(coerced.warnings.some((warning) => warning.includes("0-100")));
});

test("coerceReagentParsedPayload accepts percent strings and clamps out-of-range confidence", () => {
  const fromPercent = coerceReagentParsedPayload({ category: "KIT", confidence: "85%" });
  assert.equal(fromPercent.payload.confidence, 0.85);
  const fromGarbage = coerceReagentParsedPayload({ category: "KIT", confidence: "high" });
  assert.equal(fromGarbage.payload.confidence, 0.5);
  const fromOver = coerceReagentParsedPayload({ category: "KIT", confidence: 7 });
  assert.equal(fromOver.payload.confidence, 0.07);
});

test("coerceReagentParsedPayload uppercases lowercase antibody roles", () => {
  const coerced = coerceReagentParsedPayload({
    category: "ANTIBODY",
    confidence: 0.8,
    antibodyMeta: { role: "primary", hostSpecies: "Rabbit", targetSpecies: "Human", targetName: "CD9" },
  });
  const parsed = reagentParsedSchema.parse(coerced.payload);
  assert.equal(parsed.antibodyMeta?.role, "PRIMARY");
  assert.equal(parsed.antibodyMeta?.targetName, "CD9");
});

test("coerceReagentParsedPayload drops invented experimentTags but keeps valid ones", () => {
  const coerced = coerceReagentParsedPayload({
    category: "BIOLOGICAL",
    confidence: 0.9,
    experimentTags: ["CELL_STIMULATION_REAGENT", "wb lysis buffer", "NOT_A_REAL_TAG"],
  });
  const parsed = reagentParsedSchema.parse(coerced.payload);
  assert.deepEqual(parsed.experimentTags, ["CELL_STIMULATION_REAGENT", "WB_LYSIS_BUFFER"]);
  assert.ok(coerced.warnings.some((warning) => warning.includes("NOT_A_REAL_TAG")));
});

test("coerceReagentParsedPayload maps category synonyms and unknown values", () => {
  assert.equal(coerceReagentParsedPayload({ category: "protein", confidence: 0.5 }).payload.category, "BIOLOGICAL");
  assert.equal(coerceReagentParsedPayload({ category: "抗体", confidence: 0.5 }).payload.category, "OTHER");
});

test("coerceReagentParsedPayload unwraps single-element arrays", () => {
  const coerced = coerceReagentParsedPayload([{ category: "KIT", confidence: 0.6 }]);
  const parsed = reagentParsedSchema.parse(coerced.payload);
  assert.equal(parsed.category, "KIT");
});

test("coerceVerifiedReagentPayload fills safe verification defaults", () => {
  const coerced = coerceVerifiedReagentPayload({
    category: "BUFFER",
    confidence: 0.7,
    verification: { status: "VERIFIED", method: "External_Search", reason: "nonsense" },
  });
  const parsed = verifiedReagentParsedSchema.parse(coerced.payload);
  assert.equal(parsed.verification.status, "verified");
  assert.equal(parsed.verification.method, "external_search");
  assert.equal(parsed.verification.reason, "verified");
});

test("coerceReagentBatchExtractRows keeps usable rows and drops junk", () => {
  const rows = coerceReagentBatchExtractRows([
    { name: "DMEM 高糖培养基", catalogNo: 11965092, vendor: "Gibco" },
    { name: "  " },
    "not-a-row",
    { name: "FBS", sourceText: "FBS | Gibco | 10270" },
  ]);
  const parsed = reagentBatchExtractSchema.parse(rows);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].catalogNo, "11965092");
  assert.equal(parsed[1].sourceText, "FBS | Gibco | 10270");
});
