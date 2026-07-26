import { NextResponse } from "next/server";
import { z } from "zod";

import { publishTechniqueDraft } from "@/lib/experiment-techniques/governance";
import {
  assertLabAccess,
  canReviewExperimentTechniques,
} from "@/lib/permissions";
import { requireUserFromRequest } from "@/lib/session";

const schema = z.object({ labId: z.string().trim().min(1) });

export async function POST(
  request: Request,
  context: { params: Promise<{ draftId: string }> },
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
        { error: "PI or administrator role required", code: "PUBLISH_ROLE_REQUIRED" },
        { status: 403 },
      );
    }
    const { draftId } = await context.params;
    const technique = await publishTechniqueDraft({
      draftId,
      labId: parsed.data.labId,
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
          : message === "DRAFT_NOT_FOUND"
            ? 404
            : 409;
    return NextResponse.json(
      { error: message, code: message.split(":")[0] },
      { status },
    );
  }
}
