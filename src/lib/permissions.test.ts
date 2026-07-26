import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { canReviewExperimentTechniques } from "@/lib/permissions";

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
