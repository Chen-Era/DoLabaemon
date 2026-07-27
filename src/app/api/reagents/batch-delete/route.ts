import { NextResponse } from "next/server";
import { assertLabAccess } from "@/lib/permissions";
import { requireUserFromRequest } from "@/lib/session";
import { isDemoMode } from "@/lib/demo-mode";
import { demoDeleteReagents } from "@/lib/demo-store";
import { deleteReagents } from "@/lib/reagent-manage/manage-reagents";
import { batchDeleteSchema } from "@/lib/reagent-manage/types";

export async function POST(req: Request) {
  try {
    const user = await requireUserFromRequest(req);
    const parsed = batchDeleteSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", code: "INVALID_PAYLOAD" }, { status: 400 });
    }
    await assertLabAccess(user.id, parsed.data.labId);
    if (isDemoMode()) {
      return NextResponse.json(demoDeleteReagents(parsed.data.labId, parsed.data.ids));
    }
    const out = await deleteReagents(parsed.data.labId, parsed.data.ids);
    return NextResponse.json(out);
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    if (message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }
    if (message === "NO_LAB_ACCESS") {
      return NextResponse.json({ error: "No lab access", code: "NO_LAB_ACCESS" }, { status: 403 });
    }
    console.error("[reagents/batch-delete] failed:", error);
    return NextResponse.json({ error: "Failed to delete reagents", code: "REAGENTS_DELETE_FAILED" }, { status: 500 });
  }
}
