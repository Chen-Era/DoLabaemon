import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// demo-store.ts captures LAB_REAGENT_DEMO_STORE_PATH at module load time, so
// the env var must be set before the module is imported.
process.env.DEMO_MODE = "true";
const storeDirectory = mkdtempSync(join(tmpdir(), "demo-store-reagents-test-"));
const storePath = join(storeDirectory, "demo-store.json");
process.env.LAB_REAGENT_DEMO_STORE_PATH = storePath;

let demoStore: typeof import("@/lib/demo-store");

before(async () => {
  demoStore = await import("@/lib/demo-store");
});

const DEMO_LAB_ID = "demo-lab";

function resetStore() {
  rmSync(storePath, { force: true });
}

const baseInput = {
  labId: DEMO_LAB_ID,
  name: "Rabbit anti-LC3B",
  catalogNo: "2775S",
  category: "ANTIBODY" as const,
  vendor: "CST",
  quantity: 2,
  unit: "支",
  storageCondition: "-20°C",
  experimentTags: ["WB_PRIMARY_ANTIBODY" as const],
  antibodyMeta: { role: "PRIMARY" as const, targetName: "LC3B", hostSpecies: "Rabbit", targetSpecies: "Human" },
};

describe("demo reagent management", () => {
  void it("creates, updates and deletes a reagent", () => {
    resetStore();
    const created = demoStore.demoCreateReagent(baseInput, {
      id: "demo-user",
      name: "王小明",
      email: "wang@example.com",
    });
    assert.ok(!("error" in created));
    assert.equal(created.name, baseInput.name);
    assert.equal(created.storageCondition, "-20°C");
    assert.equal(created.uploadedById, "demo-user");
    assert.equal(created.uploadedByName, "王小明");
    assert.ok(created.uploadedAt);

    const updated = demoStore.demoUpdateReagent(created.id, {
      ...baseInput,
      name: "Rabbit anti-LC3B (updated)",
      quantity: 5,
      expiryDate: "2027-01-01",
    });
    assert.ok(!("error" in updated));
    assert.equal(updated.name, "Rabbit anti-LC3B (updated)");
    assert.equal(updated.quantity, 5);
    assert.equal(updated.expiryDate, "2027-01-01");
    assert.equal(updated.uploadedByName, "王小明");

    const removed = demoStore.demoDeleteReagent(created.id);
    assert.ok(!("error" in removed));
    assert.equal(demoStore.demoListReagents(DEMO_LAB_ID).length, 0);
  });

  void it("rejects duplicate catalog numbers inside the same lab", () => {
    resetStore();
    const created = demoStore.demoCreateReagent(baseInput);
    assert.ok(!("error" in created));

    const duplicate = demoStore.demoCreateReagent({ ...baseInput, name: "Another LC3B antibody" });
    assert.ok("error" in duplicate);
    assert.equal(duplicate.code, "CATALOG_NO_EXISTS");

    const renamed = demoStore.demoUpdateReagent(created.id, { ...baseInput, catalogNo: "2775S" });
    assert.ok(!("error" in renamed));
  });

  void it("records the confirming user as the uploader for parsed entries", () => {
    resetStore();
    const draft = demoStore.demoParseReagent({
      labId: DEMO_LAB_ID,
      userId: "demo-user",
      name: "Rabbit anti-LC3B",
      catalogNo: "2775S",
    });
    const confirmed = demoStore.demoConfirmReagent(
      {
        draftId: draft.draftId,
        editedPayload: {
          labId: DEMO_LAB_ID,
          name: "Rabbit anti-LC3B",
          catalogNo: "2775S",
          category: "ANTIBODY",
        },
      },
      { id: "demo-user", name: "李四", email: "li@example.com" },
    );
    assert.ok(!("error" in confirmed));
    assert.equal(confirmed.action, "created");

    const [reagent] = demoStore.demoListReagents(DEMO_LAB_ID);
    assert.equal(reagent.uploadedByName, "李四");
    assert.equal(reagent.uploadedById, "demo-user");
    assert.ok(reagent.uploadedAt);
  });

  void it("adjusts quantity with a zero floor and treats empty stock as zero", () => {
    resetStore();
    const created = demoStore.demoCreateReagent({ ...baseInput, quantity: null });
    assert.ok(!("error" in created));

    const increased = demoStore.demoAdjustReagentQuantity(created.id, 1);
    assert.ok(!("error" in increased));
    assert.equal(increased.beforeQuantity, null);
    assert.equal(increased.afterQuantity, 1);

    const decreased = demoStore.demoAdjustReagentQuantity(created.id, -5);
    assert.ok(!("error" in decreased));
    assert.equal(decreased.afterQuantity, 0);

    const missing = demoStore.demoAdjustReagentQuantity("does-not-exist", 1);
    assert.ok("error" in missing);
    assert.equal(missing.code, "REAGENT_NOT_FOUND");
  });

  void it("batch deletes only records of the given lab", () => {
    resetStore();
    const first = demoStore.demoCreateReagent(baseInput);
    const second = demoStore.demoCreateReagent({ ...baseInput, catalogNo: "3868S", name: "Rabbit anti-p62" });
    assert.ok(!("error" in first));
    assert.ok(!("error" in second));

    const result = demoStore.demoDeleteReagents(DEMO_LAB_ID, [first.id, second.id, "not-in-lab"]);
    assert.equal(result.deletedCount, 2);
    assert.equal(demoStore.demoListReagents(DEMO_LAB_ID).length, 0);
  });
});
