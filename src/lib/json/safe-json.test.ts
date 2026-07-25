import test from "node:test";
import assert from "node:assert/strict";
import { toSafeJsonValue } from "@/lib/json/safe-json";

test("toSafeJsonValue removes undefined and normalizes non-finite numbers", () => {
  const output = toSafeJsonValue({
    ok: true,
    skip: undefined,
    nested: {
      a: 1,
      b: undefined,
      c: NaN,
    },
    list: [1, undefined, Infinity, "x"],
  });

  assert.deepEqual(output, {
    ok: true,
    nested: {
      a: 1,
      c: null,
    },
    list: [1, null, null, "x"],
  });
});

test("toSafeJsonValue stringifies bigint and date-like values", () => {
  const output = toSafeJsonValue({
    count: BigInt(12),
    when: new Date("2026-01-02T03:04:05.000Z"),
  });

  assert.deepEqual(output, {
    count: "12",
    when: "2026-01-02T03:04:05.000Z",
  });
});
