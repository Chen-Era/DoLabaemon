import { NextResponse } from "next/server";
import { z } from "zod";

import { submitTechniqueDraft } from "@/lib/experiment-techniques/governance";
import { assertLabAccess } from "@/lib/permissions";
import { requireUserFromRequest } from "@/lib/session";

const schema = z.object({
  labId: z.string().trim().min(1),
  payload: z.record(z.string(), z.unknown()).optional(),
});

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
    await assertLabAccess(user.id, parsed.data.labId);
    const { draftId } = await context.params;
    const draft = await submitTechniqueDraft({
      draftId,
      labId: parsed.data.labId,
      userId: user.id,
      payload: parsed.data.payload,
    });
    return NextResponse.json({ draft });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status = message === "UNAUTHORIZED" ? 401 : message === "NO_LAB_ACCESS" ? 403 : message === "DRAFT_NOT_FOUND" ? 404 : 409;
    return NextResponse.json(
      { error: message, code: message.split(":")[0] },
      { status },
    );
  }
}
