import test from "node:test";
import assert from "node:assert/strict";
import {
  computeAdjustedQuantity,
  normalizeQuantityInput,
  parseDateInput,
  roundQuantity,
} from "@/lib/reagent-manage/manage-reagents";

test("parseDateInput returns null for empty input and Date for valid input", () => {
  assert.equal(parseDateInput(null), null);
  assert.equal(parseDateInput(undefined), null);
  assert.equal(parseDateInput(""), null);
  assert.equal(parseDateInput("not-a-date"), null);
  assert.deepEqual(parseDateInput("2026-03-01"), new Date("2026-03-01"));
});

test("normalizeQuantityInput keeps non-negative numbers and rejects invalid ones", () => {
  assert.equal(normalizeQuantityInput(null), null);
  assert.equal(normalizeQuantityInput(undefined), null);
  assert.equal(normalizeQuantityInput(Number.NaN), null);
  assert.equal(normalizeQuantityInput(2.5), 2.5);
  assert.equal(normalizeQuantityInput(0), 0);
});

test("computeAdjustedQuantity treats empty stock as zero and never goes negative", () => {
  assert.equal(computeAdjustedQuantity(null, 1), 1);
  assert.equal(computeAdjustedQuantity(undefined, 1), 1);
  assert.equal(computeAdjustedQuantity(2, 3), 5);
  assert.equal(computeAdjustedQuantity(2, -1), 1);
  assert.equal(computeAdjustedQuantity(2, -5), 0);
  assert.equal(computeAdjustedQuantity(0, -1), 0);
});

test("computeAdjustedQuantity rounds away float drift", () => {
  assert.equal(computeAdjustedQuantity(0.1, 0.2), 0.3);
  assert.equal(computeAdjustedQuantity(1.005, 0), 1.005);
});

test("roundQuantity trims to three decimals", () => {
  assert.equal(roundQuantity(1.0009), 1.001);
  assert.equal(roundQuantity(2), 2);
});
