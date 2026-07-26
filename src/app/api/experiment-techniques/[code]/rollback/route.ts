import { NextResponse } from "next/server";
import { z } from "zod";

import { rollbackTechniqueRevision } from "@/lib/experiment-techniques/governance";
import {
  assertLabAccess,
  canReviewExperimentTechniques,
} from "@/lib/permissions";
import { requireUserFromRequest } from "@/lib/session";

const schema = z.object({
  labId: z.string().trim().min(1),
  targetRevision: z.number().int().positive(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  try {
    const user = await requireUserFromRequest(request);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", code: "INVALID_PAYLOAD" },
        { status: 400 },
      );
    }
    const membership = await assertLabAccess(user.id, parsed.data.labId);
    if (!canReviewExperimentTechniques(membership.role)) {
      return NextResponse.json(
        { error: "PI or administrator role required", code: "ROLLBACK_ROLE_REQUIRED" },
        { status: 403 },
      );
    }
    const { code } = await context.params;
    const technique = await rollbackTechniqueRevision({
      labId: parsed.data.labId,
      code: decodeURIComponent(code),
      targetRevision: parsed.data.targetRevision,
      publisherId: user.id,
    });
    return NextResponse.json({ technique });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status =
      message === "UNAUTHORIZED"
        ? 401
        : message === "NO_LAB_ACCESS"
          ? 403
          : ["TECHNIQUE_NOT_FOUND", "REVISION_NOT_FOUND"].includes(message)
            ? 404
            : 409;
    return NextResponse.json(
      { error: message, code: message.split(":")[0] },
      { status },
    );
  }
}
