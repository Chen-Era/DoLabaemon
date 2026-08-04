import assert from "node:assert/strict";
import test from "node:test";
import {
  animalBatchAdmissionSchema,
  animalCageBatchCreateSchema,
  animalCageResetSchema,
  animalOperationCreateSchema,
  animalRackCreateSchema,
  cagePositionName,
  calculateCurrentAgeWeeks,
} from "@/lib/animal-manage/types";

test("cagePositionName follows Excel coordinates from A1 through Z26", () => {
  assert.equal(cagePositionName(1, 1), "A1");
  assert.equal(cagePositionName(26, 1), "Z1");
  assert.equal(cagePositionName(1, 26), "A26");
  assert.equal(cagePositionName(26, 26), "Z26");
  assert.throws(() => cagePositionName(27, 1), /INVALID_CAGE_POSITION/);
  assert.throws(() => cagePositionName(1, 27), /INVALID_CAGE_POSITION/);
});

test("rack validation enforces the 26 by 26 maximum", () => {
  assert.equal(animalRackCreateSchema.safeParse({ labId: "lab", name: "Rack", rows: 26, columns: 26 }).success, true);
  assert.equal(animalRackCreateSchema.safeParse({ labId: "lab", name: "Rack", rows: 27, columns: 26 }).success, false);
  assert.equal(animalRackCreateSchema.safeParse({ labId: "lab", name: "Rack", rows: 26, columns: 27 }).success, false);
});

test("operation validation supports mouse, cage, and rack batch targets", () => {
  for (const payload of [
    { labId: "lab", sourceScope: "MOUSE", mouseIds: ["m1"], operationType: "给药" },
    { labId: "lab", sourceScope: "CAGE", cageIds: ["c1"], operationType: "称重" },
    { labId: "lab", sourceScope: "RACK", rackId: "r1", operationType: "观察" },
  ]) {
    assert.equal(animalOperationCreateSchema.safeParse(payload).success, true);
  }
});

test("batch admission validates both cage selections and whole racks", () => {
  for (const payload of [
    { labId: "lab", sourceScope: "CAGE", cageIds: ["c1", "c2"], count: 3, movedAt: "2026-08-04" },
    { labId: "lab", sourceScope: "RACK", rackId: "r1", count: 2, movedAt: "2026-08-04" },
  ]) {
    assert.equal(animalBatchAdmissionSchema.safeParse(payload).success, true);
  }
  assert.equal(animalBatchAdmissionSchema.safeParse({ labId: "lab", sourceScope: "CAGE", cageIds: ["c1"], count: 0 }).success, false);
});

test("batch cage creation accepts distinct Excel positions and rejects duplicates", () => {
  const payload = {
    labId: "lab",
    rackId: "rack",
    positions: [{ rowIndex: 1, columnIndex: 1 }, { rowIndex: 2, columnIndex: 1 }],
    movedInAt: "2026-08-04",
    initialAgeWeeks: 6,
    strain: "C57BL/6J",
    sex: "FEMALE",
    mouseCount: 5,
  };
  assert.equal(animalCageBatchCreateSchema.safeParse(payload).success, true);
  assert.equal(animalCageBatchCreateSchema.safeParse({ ...payload, positions: [payload.positions[0], payload.positions[0]] }).success, false);
});

test("cage reset accepts an optional reset date and reason", () => {
  assert.equal(animalCageResetSchema.safeParse({}).success, true);
  assert.equal(animalCageResetSchema.safeParse({ resetAt: "2026-08-04", reason: "换批次" }).success, true);
  assert.equal(animalCageResetSchema.safeParse({ resetAt: "not-a-date" }).success, false);
});

test("current age accumulates from the entry date and never runs backwards", () => {
  assert.equal(calculateCurrentAgeWeeks(6, "2026-01-01", new Date("2026-01-15")), 8);
  assert.equal(calculateCurrentAgeWeeks(6, "2026-01-15", new Date("2026-01-01")), 6);
});
