import { NextResponse } from "next/server";
import { assertLabAccess } from "@/lib/permissions";
import { requireUserFromRequest } from "@/lib/session";
import { isDemoMode } from "@/lib/demo-mode";
import { demoAdjustReagentQuantity, demoGetReagentLabId } from "@/lib/demo-store";
import { adjustReagentQuantity, getReagentAccessContext } from "@/lib/reagent-manage/manage-reagents";
import { adjustQuantitySchema } from "@/lib/reagent-manage/types";

export async function POST(req: Request) {
  try {
    const user = await requireUserFromRequest(req);
    const parsed = adjustQuantitySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", code: "INVALID_PAYLOAD" }, { status: 400 });
    }
    const { reagentId, delta } = parsed.data;
    const context = isDemoMode() ? demoGetReagentLabId(reagentId) : await getReagentAccessContext(reagentId);
    if (!context) {
      return NextResponse.json({ error: "没有找到这条试剂记录。", code: "REAGENT_NOT_FOUND" }, { status: 404 });
    }
    await assertLabAccess(user.id, context.labId);
    if (isDemoMode()) {
      const out = demoAdjustReagentQuantity(reagentId, delta);
      if ("error" in out) {
        return NextResponse.json({ error: out.error, code: out.code }, { status: 404 });
      }
      return NextResponse.json(out);
    }
    const out = await adjustReagentQuantity(reagentId, delta);
    return NextResponse.json(out);
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    if (message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }
    if (message === "NO_LAB_ACCESS") {
      return NextResponse.json({ error: "No lab access", code: "NO_LAB_ACCESS" }, { status: 403 });
    }
    if (message === "REAGENT_NOT_FOUND") {
      return NextResponse.json({ error: "没有找到这条试剂记录。", code: "REAGENT_NOT_FOUND" }, { status: 404 });
    }
    console.error("[reagents/adjust-quantity] failed:", error);
    return NextResponse.json({ error: "Failed to adjust quantity", code: "REAGENT_ADJUST_FAILED" }, { status: 500 });
  }
}
