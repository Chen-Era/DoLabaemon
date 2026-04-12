import test from "node:test";
import assert from "node:assert/strict";
import {
  buildIncrementResult,
  normalizeExistingQuantity,
  summarizeBatchConfirmResults,
} from "@/lib/reagent-ingest/confirm-reagent";

test("normalizeExistingQuantity treats empty quantity as one existing stock item", () => {
  assert.equal(normalizeExistingQuantity(null), 1);
  assert.equal(normalizeExistingQuantity(undefined), 1);
  assert.equal(normalizeExistingQuantity(2), 2);
});

test("buildIncrementResult increments from null, one and many", () => {
  assert.deepEqual(buildIncrementResult("r1", null), {
    action: "incremented",
    reagentId: "r1",
    beforeQuantity: 1,
    afterQuantity: 2,
  });
  assert.deepEqual(buildIncrementResult("r2", 1), {
    action: "incremented",
    reagentId: "r2",
    beforeQuantity: 1,
    afterQuantity: 2,
  });
  assert.deepEqual(buildIncrementResult("r3", 2), {
    action: "incremented",
    reagentId: "r3",
    beforeQuantity: 2,
    afterQuantity: 3,
  });
});

test("summarizeBatchConfirmResults counts created incremented and failed rows", () => {
  const summary = summarizeBatchConfirmResults([
    { ok: true, result: { action: "created", reagentId: "a" } },
    { ok: true, result: { action: "incremented", reagentId: "b", beforeQuantity: 1, afterQuantity: 2 } },
    { ok: false, error: "INVALID_DRAFT", draftId: "d1" },
  ]);

  assert.deepEqual(summary, {
    createdCount: 1,
    incrementedCount: 1,
    failedCount: 1,
  });
});
