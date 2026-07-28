import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// demo-store.ts captures LAB_REAGENT_DEMO_STORE_PATH at module load time, so
// the env var must be set before the module is imported. node --test isolates
// each test file in its own process; we reset the store file between cases.
process.env.DEMO_MODE = "true";
const storeDirectory = mkdtempSync(join(tmpdir(), "demo-store-labs-test-"));
const storePath = join(storeDirectory, "demo-store.json");
process.env.LAB_REAGENT_DEMO_STORE_PATH = storePath;

let demoStore: typeof import("@/lib/demo-store");

before(async () => {
  demoStore = await import("@/lib/demo-store");
});

const DEMO_USER_ID = "demo-user";
const DEMO_LAB_ID = "demo-lab";

function resetStore() {
  rmSync(storePath, { force: true });
}

describe("demoRegister modes", () => {
  void it("create mode creates a lab with the user as PI", async () => {
    resetStore();
    const result = await demoStore.demoRegister({
      email: "pi@example.com",
      password: "secret123",
      mode: "create",
      labName: "新实验室",
    });
    assert.ok(!("error" in result));
    assert.equal(result.mode, "create");
    const labs = demoStore.demoLabsOf(result.userId);
    assert.equal(labs.length, 1);
    assert.equal(labs[0].role, "PI");
    assert.equal(labs[0].lab.name, "新实验室");
  });

  void it("none mode creates a user with no lab", async () => {
    resetStore();
    const result = await demoStore.demoRegister({
      email: "solo@example.com",
      password: "secret123",
      mode: "none",
    });
    assert.ok(!("error" in result));
    assert.equal(result.mode, "none");
    assert.equal(demoStore.demoLabsOf(result.userId).length, 0);
  });

  void it("invite mode joins the invited lab and consumes the invite", async () => {
    resetStore();
    const invite = demoStore.demoCreateInvite({
      userId: DEMO_USER_ID,
      labId: DEMO_LAB_ID,
      email: "newbie@example.com",
      role: "MEMBER",
    });
    assert.ok(!("error" in invite));

    const result = await demoStore.demoRegister({
      email: "newbie@example.com",
      password: "secret123",
      mode: "invite",
      inviteCode: invite.inviteId,
    });
    assert.ok(!("error" in result));
    assert.equal(result.labId, DEMO_LAB_ID);
    const labs = demoStore.demoLabsOf(result.userId);
    assert.equal(labs.length, 1);
    assert.equal(labs[0].role, "MEMBER");
    assert.equal(demoStore.demoListInvites(DEMO_LAB_ID).length, 0, "invite must be consumed");
  });

  void it("invite mode rejects mismatched email and unknown codes", async () => {
    resetStore();
    const invite = demoStore.demoCreateInvite({
      userId: DEMO_USER_ID,
      labId: DEMO_LAB_ID,
      email: "bound@example.com",
      role: "MEMBER",
    });
    assert.ok(!("error" in invite));

    const mismatch = await demoStore.demoRegister({
      email: "other@example.com",
      password: "secret123",
      mode: "invite",
      inviteCode: invite.inviteId,
    });
    assert.ok("error" in mismatch);
    assert.equal(mismatch.code, "INVITE_EMAIL_MISMATCH");

    const unknown = await demoStore.demoRegister({
      email: "bound@example.com",
      password: "secret123",
      mode: "invite",
      inviteCode: "invite-does-not-exist",
    });
    assert.ok("error" in unknown);
    assert.equal(unknown.code, "INVITE_NOT_FOUND");
  });

  void it("request mode files a PENDING join request without membership", async () => {
    resetStore();
    const result = await demoStore.demoRegister({
      email: "applicant@example.com",
      password: "secret123",
      mode: "request",
      requestLabId: DEMO_LAB_ID,
      requestMessage: "我是隔壁组的新同学",
    });
    assert.ok(!("error" in result));
    assert.equal(result.mode, "request");
    assert.equal(demoStore.demoLabsOf(result.userId).length, 0, "requester must not be a member yet");

    const lists = demoStore.demoListJoinRequests(result.userId);
    assert.equal(lists.mine.length, 1);
    assert.equal(lists.mine[0].status, "PENDING");
    assert.equal(lists.mine[0].lab.id, DEMO_LAB_ID);

    const unknownLab = await demoStore.demoRegister({
      email: "applicant2@example.com",
      password: "secret123",
      mode: "request",
      requestLabId: "lab-missing",
    });
    assert.ok("error" in unknownLab);
    assert.equal(unknownLab.code, "LAB_NOT_FOUND");
  });
});

describe("join request review flow", () => {
  void it("lists pending requests for PI/ADMIN and approves into membership", async () => {
    resetStore();
    const registered = await demoStore.demoRegister({
      email: "joiner@example.com",
      password: "secret123",
      mode: "none",
    });
    assert.ok(!("error" in registered));

    const created = demoStore.demoCreateJoinRequest({
      userId: registered.userId,
      labId: DEMO_LAB_ID,
      message: "请求加入",
    });
    assert.ok(!("error" in created));

    const piView = demoStore.demoListJoinRequests(DEMO_USER_ID);
    assert.equal(piView.pending.length, 1);
    assert.equal(piView.pending[0].user.email, "joiner@example.com");
    assert.equal(piView.pending[0].message, "请求加入");

    const reviewed = demoStore.demoReviewJoinRequest({
      requestId: created.joinRequestId,
      reviewerId: DEMO_USER_ID,
      action: "approve",
    });
    assert.ok(!("error" in reviewed));
    assert.equal(reviewed.status, "APPROVED");

    const labs = demoStore.demoLabsOf(registered.userId);
    assert.equal(labs.length, 1);
    assert.equal(labs[0].role, "MEMBER");

    const mineAfter = demoStore.demoListJoinRequests(registered.userId);
    assert.equal(mineAfter.mine[0].status, "APPROVED");
  });

  void it("rejects without creating membership and blocks double review", async () => {
    resetStore();
    const registered = await demoStore.demoRegister({
      email: "rejectme@example.com",
      password: "secret123",
      mode: "none",
    });
    assert.ok(!("error" in registered));
    const created = demoStore.demoCreateJoinRequest({ userId: registered.userId, labId: DEMO_LAB_ID });
    assert.ok(!("error" in created));

    const reviewed = demoStore.demoReviewJoinRequest({
      requestId: created.joinRequestId,
      reviewerId: DEMO_USER_ID,
      action: "reject",
    });
    assert.ok(!("error" in reviewed));
    assert.equal(reviewed.status, "REJECTED");
    assert.equal(demoStore.demoLabsOf(registered.userId).length, 0);

    const again = demoStore.demoReviewJoinRequest({
      requestId: created.joinRequestId,
      reviewerId: DEMO_USER_ID,
      action: "approve",
    });
    assert.ok("error" in again);
    assert.equal(again.code, "REQUEST_NOT_FOUND");
  });

  void it("denies review by regular members and duplicate pending requests", async () => {
    resetStore();
    const memberReg = await demoStore.demoRegister({
      email: "member@example.com",
      password: "secret123",
      mode: "none",
    });
    assert.ok(!("error" in memberReg));
    const invite = demoStore.demoCreateInvite({
      userId: DEMO_USER_ID,
      labId: DEMO_LAB_ID,
      email: "member@example.com",
      role: "MEMBER",
    });
    assert.ok(!("error" in invite));
    demoStore.demoJoinLab({ userId: memberReg.userId, email: "member@example.com", inviteId: invite.inviteId });

    const applicantReg = await demoStore.demoRegister({
      email: "applicant3@example.com",
      password: "secret123",
      mode: "none",
    });
    assert.ok(!("error" in applicantReg));
    const created = demoStore.demoCreateJoinRequest({ userId: applicantReg.userId, labId: DEMO_LAB_ID });
    assert.ok(!("error" in created));

    const denied = demoStore.demoReviewJoinRequest({
      requestId: created.joinRequestId,
      reviewerId: memberReg.userId,
      action: "approve",
    });
    assert.ok("error" in denied);
    assert.equal(denied.code, "PERMISSION_DENIED");

    const duplicate = demoStore.demoCreateJoinRequest({ userId: applicantReg.userId, labId: DEMO_LAB_ID });
    assert.ok("error" in duplicate);
    assert.equal(duplicate.code, "REQUEST_ALREADY_PENDING");

    const alreadyMember = demoStore.demoCreateJoinRequest({ userId: memberReg.userId, labId: DEMO_LAB_ID });
    assert.ok("error" in alreadyMember);
    assert.equal(alreadyMember.code, "ALREADY_IN_LAB");
  });
});

describe("member management and lab deletion", () => {
  async function setupLabWithMember(role: "ADMIN" | "MEMBER") {
    resetStore();
    const reg = await demoStore.demoRegister({
      email: `${role.toLowerCase()}@example.com`,
      password: "secret123",
      mode: "none",
    });
    assert.ok(!("error" in reg));
    const invite = demoStore.demoCreateInvite({
      userId: DEMO_USER_ID,
      labId: DEMO_LAB_ID,
      email: `${role.toLowerCase()}@example.com`,
      role,
    });
    assert.ok(!("error" in invite));
    demoStore.demoJoinLab({
      userId: reg.userId,
      email: `${role.toLowerCase()}@example.com`,
      inviteId: invite.inviteId,
    });
    return reg.userId;
  }

  void it("PI removes a member; removed user loses access", async () => {
    const memberId = await setupLabWithMember("MEMBER");
    assert.equal(demoStore.demoListLabMembers(DEMO_LAB_ID).length, 2);

    const removed = demoStore.demoRemoveLabMember({
      actorId: DEMO_USER_ID,
      labId: DEMO_LAB_ID,
      targetUserId: memberId,
    });
    assert.ok(!("error" in removed));
    assert.equal(demoStore.demoListLabMembers(DEMO_LAB_ID).length, 1);
    assert.equal(demoStore.demoLabsOf(memberId).length, 0);
    assert.equal(demoStore.demoGetLabMembership(memberId, DEMO_LAB_ID), null);
  });

  void it("removal matrix: no self-removal, PI keeps PI, ADMIN keeps non-members", async () => {
    const adminId = await setupLabWithMember("ADMIN");

    const selfRemove = demoStore.demoRemoveLabMember({
      actorId: DEMO_USER_ID,
      labId: DEMO_LAB_ID,
      targetUserId: DEMO_USER_ID,
    });
    assert.ok("error" in selfRemove);
    assert.equal(selfRemove.code, "PERMISSION_DENIED");

    const piVsPi = demoStore.demoRemoveLabMember({
      actorId: adminId,
      labId: DEMO_LAB_ID,
      targetUserId: DEMO_USER_ID,
    });
    assert.ok("error" in piVsPi);
    assert.equal(piVsPi.code, "PERMISSION_DENIED");

    const adminVsAdmin = demoStore.demoRemoveLabMember({
      actorId: adminId,
      labId: DEMO_LAB_ID,
      targetUserId: DEMO_USER_ID,
    });
    assert.ok("error" in adminVsAdmin);

    const missing = demoStore.demoRemoveLabMember({
      actorId: DEMO_USER_ID,
      labId: DEMO_LAB_ID,
      targetUserId: "user-missing",
    });
    assert.ok("error" in missing);
    assert.equal(missing.code, "MEMBER_NOT_FOUND");
  });

  void it("updates non-PI roles while preserving PI ownership", async () => {
    const memberId = await setupLabWithMember("MEMBER");
    const promoted = demoStore.demoUpdateLabMemberRole({
      actorId: DEMO_USER_ID,
      labId: DEMO_LAB_ID,
      targetUserId: memberId,
      role: "ADMIN",
    });
    assert.ok(!("error" in promoted));
    assert.equal(demoStore.demoGetLabMembership(memberId, DEMO_LAB_ID)?.role, "ADMIN");

    const secondAdmin = await demoStore.demoRegister({
      email: "second-admin@example.com",
      password: "secret123",
      mode: "none",
    });
    assert.ok(!("error" in secondAdmin));
    const adminInvite = demoStore.demoCreateInvite({
      userId: DEMO_USER_ID,
      labId: DEMO_LAB_ID,
      email: "second-admin@example.com",
      role: "ADMIN",
    });
    assert.ok(!("error" in adminInvite));
    const joined = demoStore.demoJoinLab({
      userId: secondAdmin.userId,
      email: "second-admin@example.com",
      inviteId: adminInvite.inviteId,
    });
    assert.ok(!("error" in joined));

    const demotedByAdmin = demoStore.demoUpdateLabMemberRole({
      actorId: memberId,
      labId: DEMO_LAB_ID,
      targetUserId: secondAdmin.userId,
      role: "MEMBER",
    });
    assert.ok(!("error" in demotedByAdmin));
    assert.equal(demoStore.demoGetLabMembership(secondAdmin.userId, DEMO_LAB_ID)?.role, "MEMBER");

    const piChange = demoStore.demoUpdateLabMemberRole({
      actorId: DEMO_USER_ID,
      labId: DEMO_LAB_ID,
      targetUserId: DEMO_USER_ID,
      role: "MEMBER",
    });
    assert.ok("error" in piChange);
    assert.equal(piChange.code, "PERMISSION_DENIED");

    const adminPromotion = demoStore.demoUpdateLabMemberRole({
      actorId: memberId,
      labId: DEMO_LAB_ID,
      targetUserId: secondAdmin.userId,
      role: "ADMIN",
    });
    assert.ok("error" in adminPromotion);
    assert.equal(adminPromotion.code, "PERMISSION_DENIED");
  });

  void it("only lets PI view administrator invitations", async () => {
    const adminId = await setupLabWithMember("ADMIN");
    const adminInvite = demoStore.demoCreateInvite({
      userId: DEMO_USER_ID,
      labId: DEMO_LAB_ID,
      email: "admin-invite@example.com",
      role: "ADMIN",
    });
    assert.ok(!("error" in adminInvite));
    const memberInvite = demoStore.demoCreateInvite({
      userId: DEMO_USER_ID,
      labId: DEMO_LAB_ID,
      email: "member-invite@example.com",
      role: "MEMBER",
    });
    assert.ok(!("error" in memberInvite));

    assert.equal(demoStore.demoListInvites(DEMO_LAB_ID, "PI").length, 2);
    const adminVisibleInvites = demoStore.demoListInvites(DEMO_LAB_ID, "ADMIN");
    assert.equal(adminVisibleInvites.length, 1);
    assert.equal(adminVisibleInvites[0]?.role, "MEMBER");
    assert.equal(demoStore.demoGetLabMembership(adminId, DEMO_LAB_ID)?.role, "ADMIN");
  });

  void it("PI deletes a lab and cascades its data; members cannot delete", async () => {
    const memberId = await setupLabWithMember("MEMBER");

    const denied = demoStore.demoDeleteLab({ userId: memberId, labId: DEMO_LAB_ID });
    assert.ok("error" in denied);
    assert.equal(denied.code, "PERMISSION_DENIED");

    const created = demoStore.demoParseReagent({ labId: DEMO_LAB_ID, userId: DEMO_USER_ID, name: "甲醇" });
    demoStore.demoConfirmReagent({
      draftId: created.draftId,
      editedPayload: { labId: DEMO_LAB_ID, name: "甲醇", catalogNo: "M-1", category: "CHEMICAL" },
    });
    assert.equal(demoStore.demoListReagents(DEMO_LAB_ID).length, 1);

    const deleted = demoStore.demoDeleteLab({ userId: DEMO_USER_ID, labId: DEMO_LAB_ID });
    assert.ok(!("error" in deleted));
    assert.equal(demoStore.demoLabsOf(DEMO_USER_ID).length, 0);
    assert.equal(demoStore.demoLabsOf(memberId).length, 0);
    assert.equal(demoStore.demoListReagents(DEMO_LAB_ID).length, 0);
    assert.equal(demoStore.demoListLabMembers(DEMO_LAB_ID).length, 0);
  });
});

describe("lab directory search", () => {
  void it("matches case-insensitively and reports member counts", async () => {
    resetStore();
    const hits = demoStore.demoSearchLabs("demo");
    assert.equal(hits.length, 1);
    assert.equal(hits[0].id, DEMO_LAB_ID);
    assert.equal(hits[0].memberCount, 1);

    assert.equal(demoStore.demoSearchLabs("DEMO LAB").length, 1);
    assert.equal(demoStore.demoSearchLabs("不存在的实验室").length, 0);
    assert.equal(demoStore.demoSearchLabs("  ").length, 0);
  });
});
