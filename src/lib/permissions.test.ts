import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  canDeleteLab,
  canManageLabLlmConfig,
  canRemoveMember,
  canReviewExperimentTechniques,
  canReviewJoinRequests,
  canUpdateMemberRole,
} from "@/lib/permissions";

function readLabRolesFromSchema(): string[] {
  const schema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");
  const match = schema.match(/enum\s+LabRole\s*\{([^}]*)\}/);
  assert.ok(match, "prisma/schema.prisma must declare the LabRole enum");
  return match[1]
    .split(/[\s,/]+/)
    .map((token) => token.trim())
    .filter((token) => /^[A-Z][A-Z0-9_]*$/.test(token));
}

describe("canReviewExperimentTechniques permission matrix", () => {
  void it("grants PI and ADMIN and denies every other LabRole from the schema", () => {
    const roles = readLabRolesFromSchema();
    assert.ok(roles.includes("PI"), "LabRole enum must contain PI");
    assert.ok(roles.includes("ADMIN"), "LabRole enum must contain ADMIN");
    assert.ok(
      roles.length >= 3,
      `expected LabRole to contain at least one non-privileged role, got ${roles.join(", ")}`,
    );
    for (const role of roles) {
      const expected = role === "PI" || role === "ADMIN";
      assert.equal(
        canReviewExperimentTechniques(role as "PI" | "ADMIN" | "MEMBER"),
        expected,
        `role ${role} must ${expected ? "be allowed" : "be denied"} to review experiment techniques`,
      );
    }
  });

  void it("explicitly grants PI and ADMIN", () => {
    assert.equal(canReviewExperimentTechniques("PI"), true);
    assert.equal(canReviewExperimentTechniques("ADMIN"), true);
  });

  void it("explicitly denies MEMBER", () => {
    assert.equal(canReviewExperimentTechniques("MEMBER"), false);
  });
});

describe("canManageLabLlmConfig permission matrix", () => {
  void it("grants PI and ADMIN while denying MEMBER", () => {
    assert.equal(canManageLabLlmConfig("PI"), true);
    assert.equal(canManageLabLlmConfig("ADMIN"), true);
    assert.equal(canManageLabLlmConfig("MEMBER"), false);
  });
});

describe("canReviewJoinRequests permission matrix", () => {
  void it("grants PI and ADMIN, denies every other LabRole from the schema", () => {
    for (const role of readLabRolesFromSchema()) {
      const expected = role === "PI" || role === "ADMIN";
      assert.equal(
        canReviewJoinRequests(role as "PI" | "ADMIN" | "MEMBER"),
        expected,
        `role ${role} must ${expected ? "be allowed" : "be denied"} to review join requests`,
      );
    }
  });
});

describe("canDeleteLab permission matrix", () => {
  void it("grants only PI", () => {
    for (const role of readLabRolesFromSchema()) {
      const expected = role === "PI";
      assert.equal(
        canDeleteLab(role as "PI" | "ADMIN" | "MEMBER"),
        expected,
        `role ${role} must ${expected ? "be allowed" : "be denied"} to delete a lab`,
      );
    }
  });
});

describe("canRemoveMember permission matrix", () => {
  void it("PI removes ADMIN and MEMBER but not another PI", () => {
    assert.equal(canRemoveMember("PI", "ADMIN", false), true);
    assert.equal(canRemoveMember("PI", "MEMBER", false), true);
    assert.equal(canRemoveMember("PI", "PI", false), false);
  });

  void it("ADMIN removes only MEMBER", () => {
    assert.equal(canRemoveMember("ADMIN", "MEMBER", false), true);
    assert.equal(canRemoveMember("ADMIN", "ADMIN", false), false);
    assert.equal(canRemoveMember("ADMIN", "PI", false), false);
  });

  void it("MEMBER removes nobody", () => {
    assert.equal(canRemoveMember("MEMBER", "MEMBER", false), false);
    assert.equal(canRemoveMember("MEMBER", "PI", false), false);
  });

  void it("nobody removes themselves", () => {
    assert.equal(canRemoveMember("PI", "PI", true), false);
    assert.equal(canRemoveMember("ADMIN", "ADMIN", true), false);
    assert.equal(canRemoveMember("MEMBER", "MEMBER", true), false);
  });
});

describe("canUpdateMemberRole permission matrix", () => {
  void it("allows PI to promote or demote another non-PI member", () => {
    assert.equal(canUpdateMemberRole("PI", "MEMBER", "ADMIN", false), true);
    assert.equal(canUpdateMemberRole("PI", "ADMIN", "MEMBER", false), true);
  });

  void it("allows ADMIN to demote another administrator but never to grant ADMIN", () => {
    assert.equal(canUpdateMemberRole("ADMIN", "ADMIN", "MEMBER", false), true);
    assert.equal(canUpdateMemberRole("ADMIN", "MEMBER", "ADMIN", false), false);
  });

  void it("protects PI members and blocks all role changes to PI", () => {
    assert.equal(canUpdateMemberRole("PI", "PI", "MEMBER", false), false);
    assert.equal(canUpdateMemberRole("PI", "MEMBER", "PI", false), false);
    assert.equal(canUpdateMemberRole("ADMIN", "PI", "MEMBER", false), false);
  });

  void it("does not allow a user to change their own role or submit a no-op", () => {
    assert.equal(canUpdateMemberRole("PI", "ADMIN", "MEMBER", true), false);
    assert.equal(canUpdateMemberRole("PI", "MEMBER", "MEMBER", false), false);
  });
});
