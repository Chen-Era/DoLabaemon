import assert from "node:assert/strict";
import test from "node:test";
import { ReagentCategory } from "@prisma/client";
import {
  rankInventoryMatches,
  toRecordSafeInventoryReagent,
  toRecordSafeReagentResolution,
} from "@/lib/mcp/lab-inventory";

const baseRow = {
  quantity: 1,
  unit: "vial",
  expiryDate: new Date("2030-01-01T00:00:00.000Z"),
};

test("matches β-actin queries to ACTB without changing the catalog identity", () => {
  const matches = rankInventoryMatches([
    {
      ...baseRow,
      id: "actb-primary",
      name: "Mouse anti-ACTB",
      catalogNo: "A1978",
      vendor: "Sigma",
      category: ReagentCategory.ANTIBODY,
      antibodyMeta: { role: "PRIMARY", targetName: "ACTB" },
    },
  ], "β-actin");

  assert.equal(matches.length, 1);
  assert.equal(matches[0].catalogNo, "A1978");
  assert.equal(matches[0].match.field, "targetName");
  assert.equal(matches[0].match.score, 100);
});

test("ranks an exact antibody target ahead of a fuzzy reagent name", () => {
  const matches = rankInventoryMatches([
    {
      ...baseRow,
      id: "name-only",
      name: "KLF6 antibody panel reference",
      catalogNo: "REF-1",
      vendor: "Vendor A",
      category: ReagentCategory.ANTIBODY,
      antibodyMeta: { role: "PRIMARY", targetName: null },
    },
    {
      ...baseRow,
      id: "exact-target",
      name: "Rabbit anti-KLF6",
      catalogNo: "KLF6-01",
      vendor: "Vendor B",
      category: ReagentCategory.ANTIBODY,
      antibodyMeta: { role: "PRIMARY", targetName: "KLF6" },
    },
  ], "KLF6");

  assert.deepEqual(matches.map((item) => item.reagentId), ["exact-target", "name-only"]);
  assert.equal(matches[0].match.score, 100);
  assert.equal(matches[1].match.score, 55);
});

test("reports out-of-stock and expired inventory without hiding it", () => {
  const matches = rankInventoryMatches([
    {
      ...baseRow,
      id: "expired",
      name: "Rabbit anti-KLF6",
      catalogNo: "KLF6-OLD",
      vendor: null,
      category: ReagentCategory.ANTIBODY,
      expiryDate: new Date("2020-01-01T00:00:00.000Z"),
      antibodyMeta: { role: "PRIMARY", targetName: "KLF6" },
    },
    {
      ...baseRow,
      id: "empty",
      name: "Rabbit anti-KLF6",
      catalogNo: "KLF6-EMPTY",
      vendor: null,
      category: ReagentCategory.ANTIBODY,
      quantity: 0,
      antibodyMeta: { role: "PRIMARY", targetName: "KLF6" },
    },
  ], "KLF6");

  assert.deepEqual(matches.map((item) => item.availability.state).sort(), ["expired", "out_of_stock"]);
});

test("projects candidates to fields that are safe to place in an experimental record", () => {
  const [candidate] = rankInventoryMatches([
    {
      ...baseRow,
      id: "internal-reagent-id",
      name: "Rabbit anti-KLF6",
      catalogNo: "KLF6-01",
      vendor: "Proteintech",
      category: ReagentCategory.ANTIBODY,
      antibodyMeta: { role: "PRIMARY", targetName: "KLF6" },
    },
  ], "KLF6");

  assert.deepEqual(toRecordSafeInventoryReagent(candidate), {
    reagentName: "Rabbit anti-KLF6",
    manufacturer: "Proteintech",
    catalogNumber: "KLF6-01",
    category: ReagentCategory.ANTIBODY,
    antibody: { role: "PRIMARY", targetName: "KLF6" },
    availability: { state: "available" },
  });
});

test("projects Western-blot resolutions without inventory provenance", () => {
  const [candidate] = rankInventoryMatches([
    {
      ...baseRow,
      id: "internal-reagent-id",
      name: "Rabbit anti-KLF6",
      catalogNo: "KLF6-01",
      vendor: "Proteintech",
      category: ReagentCategory.ANTIBODY,
      antibodyMeta: { role: "PRIMARY", targetName: "KLF6" },
    },
  ], "KLF6");

  assert.deepEqual(toRecordSafeReagentResolution({
    target: "KLF6",
    status: "resolved",
    selected: candidate,
    candidates: [candidate],
    requiresUserConfirmation: false,
    warnings: [],
  }), {
    target: "KLF6",
    status: "resolved",
    selected: {
      reagentName: "Rabbit anti-KLF6",
      manufacturer: "Proteintech",
      catalogNumber: "KLF6-01",
      category: ReagentCategory.ANTIBODY,
      antibody: { role: "PRIMARY", targetName: "KLF6" },
      availability: { state: "available" },
    },
    candidates: [{
      reagentName: "Rabbit anti-KLF6",
      manufacturer: "Proteintech",
      catalogNumber: "KLF6-01",
      category: ReagentCategory.ANTIBODY,
      antibody: { role: "PRIMARY", targetName: "KLF6" },
      availability: { state: "available" },
    }],
    requiresUserConfirmation: false,
    warnings: [],
  });
});
