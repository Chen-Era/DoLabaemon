import test from "node:test";
import assert from "node:assert/strict";
import { mapWithConcurrency } from "@/lib/async/map-with-concurrency";

test("mapWithConcurrency keeps result order while limiting concurrency", async () => {
  let active = 0;
  let maxActive = 0;

  const results = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (value) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise((resolve) => setTimeout(resolve, value % 2 === 0 ? 15 : 5));
    active -= 1;
    return value * 10;
  });

  assert.deepEqual(results, [10, 20, 30, 40, 50]);
  assert.equal(maxActive, 2);
});
