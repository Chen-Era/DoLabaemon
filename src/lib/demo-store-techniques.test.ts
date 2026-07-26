import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { ExperimentTechnique } from "@/lib/experiment-techniques/types";

// demo-store.ts captures LAB_REAGENT_DEMO_STORE_PATH at module load time and
// isDemoMode() reads DEMO_MODE, so both must be set before the modules under
// test are imported. The imports therefore happen dynamically in before().
// node --test isolates each test file in its own process; within this file we
// reset the store file between cases (readStore re-creates defaults when the
// file is missing) and use case-specific technique codes to avoid pollution.
process.env.DEMO_MODE = "true";
const storeDirectory = mkdtempSync(join(tmpdir(), "demo-store-techniques-test-"));
const storePath = join(storeDirectory, "demo-store.json");
process.env.LAB_REAGENT_DEMO_STORE_PATH = storePath;

let demoStore: typeof import("@/lib/demo-store");
let governance: typeof import("@/lib/experiment-techniques/governance");
let catalog: typeof import("@/lib/experiment-techniques/catalog");

before(async () => {
  demoStore = await import("@/lib/demo-store");
  governance = await import("@/lib/experiment-techniques/governance");
  catalog = await import("@/lib/experiment-techniques/catalog");
});

const LAB_ID = "demo-lab";
const USER_ID = "demo-user";
const BASE_LEAF_CODE = "SANDWICH_ELISA";

function resetStore() {
  rmSync(storePath, { force: true });
}

function baseLeaf(): ExperimentTechnique {
  const technique = catalog.repositoryTechniqueByCode.get(BASE_LEAF_CODE);
  assert.ok(technique, `repository catalog must contain ${BASE_LEAF_CODE}`);
  assert.equal(technique.isAbstract, false, `${BASE_LEAF_CODE} must be a leaf`);
  return structuredClone(technique);
}

// The publication gate currently rejects every repository leaf because OBI,
// CHMO or MeSH term mappings have not been curated yet (the data fix is being
// done in parallel). Injecting one valid mapping keeps this test focused on
// the governance flow instead of the pending data curation.
const gateOntologyMapping = {
  scheme: "OBI" as const,
  termId: "OBI:0000070",
  termUri: "http://purl.obolibrary.org/obo/OBI_0000070",
  termLabel: "assay",
  relation: "EXACT" as const,
  version: "2024-06-03",
};

function overrideTechnique(
  code: string,
  revision: number,
): ExperimentTechnique {
  const technique = baseLeaf();
  technique.id = `curated:${code.toLowerCase()}`;
  technique.code = code;
  technique.slug = code.toLowerCase().replace(/_/g, "-");
  technique.revision = revision;
  technique.ontologyMappings = [gateOntologyMapping];
  return technique;
}

describe("demo technique draft isolation", () => {
  void it("scopes drafts to their lab across demo-store and governance lookups", async () => {
    resetStore();
    const draftA = demoStore.demoCreateTechniqueDraft({
      labId: "lab-a",
      createdById: "user-a",
      baseCode: BASE_LEAF_CODE,
      baseRevision: 1,
      status: "DRAFT",
      source: "CURATED",
      payload: { code: "TEST_ISOLATION_A" },
      reviewerId: null,
      reviewNote: "",
      submittedAt: null,
      reviewedAt: null,
    });
    const draftB = demoStore.demoCreateTechniqueDraft({
      labId: "lab-b",
      createdById: "user-b",
      baseCode: BASE_LEAF_CODE,
      baseRevision: 1,
      status: "DRAFT",
      source: "CURATED",
      payload: { code: "TEST_ISOLATION_B" },
      reviewerId: null,
      reviewNote: "",
      submittedAt: null,
      reviewedAt: null,
    });

    const listA = demoStore.demoListTechniqueDrafts("lab-a");
    assert.ok(
      listA.some((draft) => draft.id === draftA.id),
      "lab-a listing must contain its own draft",
    );
    assert.ok(
      listA.every((draft) => draft.labId === "lab-a"),
      `lab-a listing must not contain other labs' drafts, got ${JSON.stringify(
        listA.map((draft) => [draft.id, draft.labId]),
      )}`,
    );

    const crossLab = await governance.getTechniqueDraftForLab(draftB.id, "lab-a");
    assert.equal(
      crossLab,
      null,
      "governance.getTechniqueDraftForLab must return null across labs",
    );
    const ownLab = await governance.getTechniqueDraftForLab(draftB.id, "lab-b");
    assert.equal(ownLab?.id, draftB.id);
  });
});

describe("demo technique override revision recording", () => {
  const CODE = "TEST_REVISION_RECORDING";

  void it("records one revision per upserted (code, revision) pair, idempotently", () => {
    resetStore();
    assert.equal(
      typeof demoStore.demoListTechniqueRevisions,
      "function",
      "demoListTechniqueRevisions is not implemented in demo-store.ts yet",
    );
    assert.equal(
      typeof demoStore.demoGetTechniqueRevision,
      "function",
      "demoGetTechniqueRevision is not implemented in demo-store.ts yet",
    );

    const technique = overrideTechnique(CODE, 1);
    demoStore.demoUpsertTechniqueOverride(technique, {
      changeSummary: "初次发布",
      labId: "lab-a",
      publishedById: "user-a",
    });

    const revisions = demoStore.demoListTechniqueRevisions(CODE);
    assert.equal(revisions.length, 1, "first upsert must record exactly one revision");
    const [first] = revisions;
    assert.equal(first.code, CODE);
    assert.equal(first.revision, 1);
    assert.equal(first.snapshot.code, CODE);
    assert.equal(first.contentHash, technique.contentHash);
    assert.equal(first.changeSummary, "初次发布");
    assert.equal(first.restoredFromRevision, null);
    assert.equal(first.labId, "lab-a");
    assert.equal(first.publishedById, "user-a");
    assert.equal(typeof first.createdAt, "string");

    demoStore.demoUpsertTechniqueOverride(technique, { changeSummary: "重复写入" });
    assert.equal(
      demoStore.demoListTechniqueRevisions(CODE).length,
      1,
      "repeating the same (code, revision) upsert must not duplicate the history entry",
    );

    const fetched = demoStore.demoGetTechniqueRevision(CODE, 1);
    assert.equal(fetched?.revision, 1);
    assert.equal(
      demoStore.demoGetTechniqueRevision(CODE, 2),
      null,
      "unknown revisions must return null",
    );
  });
});

async function runDraftToPublish(
  code: string,
  name: { zh: string; en: string },
) {
  const draft = await governance.createTechniqueDraft({
    labId: LAB_ID,
    userId: USER_ID,
    baseCode: BASE_LEAF_CODE,
    payload: {
      id: `curated:${code.toLowerCase()}`,
      code,
      slug: code.toLowerCase().replace(/_/g, "-"),
      ontologyMappings: [gateOntologyMapping],
    },
    source: "CURATED",
  });
  await governance.submitTechniqueDraft({
    draftId: draft.id,
    labId: LAB_ID,
    userId: USER_ID,
    payload: { name },
  });
  await governance.reviewTechniqueDraft({
    draftId: draft.id,
    labId: LAB_ID,
    reviewerId: USER_ID,
    action: "APPROVE",
    note: "looks good",
  });
  return governance.publishTechniqueDraft({
    draftId: draft.id,
    labId: LAB_ID,
    publisherId: USER_ID,
  });
}

describe("demo technique governance lifecycle", () => {
  void it("contract: the first publish of a leaf-based draft is recorded as revision 1", async () => {
    resetStore();
    const published = await runDraftToPublish("TEST_CONTRACT_REVISION_ONE", {
      zh: "契约版本一",
      en: "Contract revision one",
    });
    assert.equal(
      published.revision,
      1,
      "contract requires the first published revision of a leaf-based draft to be 1; " +
        `got ${published.revision} (publishTechniqueDraft computes ` +
        "max(existing.revision + 1, baseRevision + 1) and a real leaf has revision 1)",
    );
    const revisions = demoStore.demoListTechniqueRevisions(published.code);
    assert.equal(revisions.length, 1);
    assert.equal(revisions[0]?.revision, 1);
  });

  void it("publishes, republishes and rolls back a technique through the demo override store", async () => {
    resetStore();
    const CODE = "TEST_GOVERNANCE_FLOW";

    const published1 = await runDraftToPublish(CODE, {
      zh: "治理流 V1",
      en: "Governance flow V1",
    });
    const firstRevision = published1.revision;

    const overridesAfterFirst = demoStore.demoListTechniqueOverrides();
    assert.ok(
      overridesAfterFirst.some(
        (technique) =>
          technique.code === CODE && technique.revision === firstRevision,
      ),
      "demoListTechniqueOverrides must contain the published technique",
    );
    const historyAfterFirst = demoStore.demoListTechniqueRevisions(CODE);
    assert.deepEqual(
      historyAfterFirst.map((entry) => entry.revision),
      [firstRevision],
      "revision history must start with the first published revision",
    );

    const published2 = await runDraftToPublish(CODE, {
      zh: "治理流 V2",
      en: "Governance flow V2",
    });
    assert.equal(
      published2.revision,
      firstRevision + 1,
      "republishing must bump the revision",
    );
    assert.deepEqual(
      demoStore.demoListTechniqueRevisions(CODE).map((entry) => entry.revision),
      [firstRevision, firstRevision + 1],
      "revision history must be ascending",
    );

    const restored = await governance.rollbackTechniqueRevision({
      labId: LAB_ID,
      code: CODE,
      targetRevision: firstRevision,
      publisherId: USER_ID,
    });
    assert.equal(
      restored.revision,
      firstRevision + 2,
      "rollback must create a new revision on top of the current one",
    );
    assert.equal(restored.name.en, published1.name.en);
    assert.equal(restored.name.zh, published1.name.zh);
    assert.equal(restored.principle.zh, published1.principle.zh);
    assert.equal(restored.principle.en, published1.principle.en);

    const overrideAfterRollback = demoStore
      .demoListTechniqueOverrides()
      .find((technique) => technique.code === CODE);
    assert.equal(
      overrideAfterRollback?.name.en,
      published1.name.en,
      "override content must return to the target revision snapshot",
    );
    assert.equal(overrideAfterRollback?.principle.zh, published1.principle.zh);
    assert.equal(overrideAfterRollback?.revision, firstRevision + 2);

    const history = demoStore.demoListTechniqueRevisions(CODE);
    assert.equal(history.length, 3, "history must keep publish, republish and rollback entries");
    assert.deepEqual(
      history.map((entry) => entry.revision),
      [firstRevision, firstRevision + 1, firstRevision + 2],
      "revision history must stay ascending after rollback",
    );
    const rollbackEntry = history[2];
    assert.equal(rollbackEntry?.restoredFromRevision, firstRevision);
    assert.match(rollbackEntry?.changeSummary ?? "", /Restored/);
    assert.equal(rollbackEntry?.snapshot.name.en, published1.name.en);
  });

  void it("rejects rollback to a revision that does not exist", async () => {
    resetStore();
    const CODE = "TEST_ERR_UNKNOWN_REVISION";
    demoStore.demoUpsertTechniqueOverride(overrideTechnique(CODE, 1), {
      changeSummary: "seed",
    });
    await assert.rejects(
      governance.rollbackTechniqueRevision({
        labId: LAB_ID,
        code: CODE,
        targetRevision: 99,
        publisherId: USER_ID,
      }),
      /REVISION_NOT_FOUND/,
    );
  });

  void it("rejects rollback for a code that has no override", async () => {
    resetStore();
    await assert.rejects(
      governance.rollbackTechniqueRevision({
        labId: LAB_ID,
        code: "TEST_ERR_NO_OVERRIDE",
        targetRevision: 1,
        publisherId: USER_ID,
      }),
      /TECHNIQUE_NOT_FOUND/,
    );
  });
});
