import assert from "node:assert/strict";
import test from "node:test";
import { buildReagentUploadProvenance } from "@/lib/reagent-provenance";

test("buildReagentUploadProvenance snapshots the uploader name", () => {
  assert.deepEqual(buildReagentUploadProvenance({ id: "user-1", name: "  王小明  ", email: "wang@example.com" }), {
    uploadedById: "user-1",
    uploadedByName: "王小明",
  });
});

test("buildReagentUploadProvenance falls back to the account email", () => {
  assert.deepEqual(buildReagentUploadProvenance({ id: "user-1", name: " ", email: "wang@example.com" }), {
    uploadedById: "user-1",
    uploadedByName: "wang@example.com",
  });
});
