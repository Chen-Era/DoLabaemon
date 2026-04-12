import { NextResponse } from "next/server";
import { z } from "zod";
import { assertLabAccess } from "@/lib/permissions";
import { requireUserFromRequest } from "@/lib/session";
import { isDemoMode } from "@/lib/demo-mode";
import { demoConfirmReagent } from "@/lib/demo-store";
import { confirmReagentDraft } from "@/lib/reagent-ingest/confirm-reagent";
import { confirmEditedPayloadSchema } from "@/lib/reagent-ingest/types";

const schema = z.object({
  draftId: z.string().min(1),
  editedPayload: confirmEditedPayloadSchema,
});

export async function POST(req: Request) {
  try {
    const user = await requireUserFromRequest(req);
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", code: "INVALID_PAYLOAD" }, { status: 400 });
    }
    if (isDemoMode()) {
      const out = demoConfirmReagent(parsed.data);
      if ("error" in out) {
        return NextResponse.json({ error: out.error, code: out.code }, { status: 400 });
      }
      return NextResponse.json(out);
    }
    await assertLabAccess(user.id, parsed.data.editedPayload.labId);
    const out = await confirmReagentDraft(parsed.data);
    return NextResponse.json(out);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "INVALID_DRAFT") {
      return NextResponse.json({ error: "Invalid draft", code: "INVALID_DRAFT" }, { status: 400 });
    }
    console.error("[reagent-confirm] request failed:", error);
    return NextResponse.json({ error: "Confirm request failed", code: "CONFIRM_REQUEST_FAILED" }, { status: 500 });
  }
}
