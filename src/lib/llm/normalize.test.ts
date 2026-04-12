import test from "node:test";
import assert from "node:assert/strict";
import { normalizeLlmParsedPayload } from "@/lib/llm/normalize";
import { reagentParsedSchema } from "@/lib/llm/schemas";

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
