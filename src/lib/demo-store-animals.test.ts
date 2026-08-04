import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

// demo-store captures its storage path at import time, so each test file gets
// an isolated store before loading the module.
const storeDirectory = mkdtempSync(join(tmpdir(), "demo-store-animals-test-"));
process.env.LAB_REAGENT_DEMO_STORE_PATH = join(storeDirectory, "demo-store.json");

let demoStore: typeof import("@/lib/demo-store");

test.before(async () => {
  demoStore = await import("@/lib/demo-store");
});

test.after(() => {
  rmSync(storeDirectory, { recursive: true, force: true });
});

test("demo animal records retain per-mouse operations after a cage becomes empty", () => {
  const rack = demoStore.demoCreateAnimalRack({ labId: "demo-lab", name: "测试笼架", rows: 26, columns: 26 });
  const cage = demoStore.demoCreateAnimalCage({
    labId: "demo-lab",
    rackId: rack.id,
    rowIndex: 26,
    columnIndex: 26,
    movedInAt: "2026-08-01",
    initialAgeWeeks: 6,
    strain: "C57BL/6J",
    sex: "MIXED",
    mouseCount: 2,
  }, "demo-user");

  assert.equal(cage.positionName, "Z26");
  assert.equal(cage.mouseCount, 2);
  assert.equal(cage.genotype, "WT", "an unspecified genotype defaults to wild type");

  const batchCages = demoStore.demoCreateAnimalCagesBatch({
    labId: "demo-lab",
    rackId: rack.id,
    positions: [{ rowIndex: 1, columnIndex: 1 }, { rowIndex: 1, columnIndex: 2 }],
    movedInAt: "2026-08-01",
    initialAgeWeeks: 6,
    strain: "C57BL/6J",
    sex: "FEMALE",
    mouseCount: 5,
  }, "demo-user");
  assert.equal(batchCages.length, 2);
  assert.ok(batchCages.every((item) => item.mouseCount === 5), "initial per-cage counts are persisted as mouse records");

  const admission = demoStore.demoBatchAdmitAnimalCages({
    labId: "demo-lab",
    sourceScope: "CAGE",
    cageIds: [cage.id],
    count: 3,
    movedAt: "2026-08-02",
    note: "同批入驻",
  }, "demo-user");
  assert.equal(admission.affectedCageCount, 1);
  assert.equal(admission.admittedCount, 3);

  const operation = demoStore.demoCreateAnimalOperations({
    labId: "demo-lab",
    sourceScope: "CAGE",
    cageIds: [cage.id],
    operationType: "给药",
    operationAt: "2026-08-02",
  }, "demo-user");
  assert.equal(operation.createdCount, 5);

  demoStore.demoUpdateAnimalCageResidents(cage.id, {
    action: "DEPART",
    count: 5,
    movedAt: "2026-08-03",
    leaveReason: "终点取材",
  }, "demo-user");

  const detail = demoStore.demoGetAnimalRack(rack.id);
  const persistedCage = detail?.cages.find((item) => item.id === cage.id);
  assert.equal(persistedCage?.mouseCount, 0);
  assert.equal(persistedCage?.mice.length, 5, "detail keeps former mice for audit history");
  assert.ok(persistedCage?.mice.every((mouse) => mouse.operations.some((item) => item.operationType === "给药")));
  assert.ok(persistedCage?.mice.every((mouse) => mouse.operations.some((item) => item.operationType === "离笼")));
});
