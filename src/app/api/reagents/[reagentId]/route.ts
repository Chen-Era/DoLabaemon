import { NextResponse } from "next/server";
import { assertLabAccess } from "@/lib/permissions";
import { requireUserFromRequest } from "@/lib/session";
import { isDemoMode } from "@/lib/demo-mode";
import { demoDeleteReagent, demoGetReagentLabId, demoUpdateReagent } from "@/lib/demo-store";
import { deleteReagent, getReagentAccessContext, updateReagent } from "@/lib/reagent-manage/manage-reagents";
import { reagentUpdateSchema } from "@/lib/reagent-manage/types";

type RouteParams = { params: Promise<{ reagentId: string }> };

function toErrorResponse(error: unknown) {
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
  if (message === "CATALOG_NO_EXISTS") {
    return NextResponse.json(
      { error: "该货号在当前实验室已存在，可直接编辑原有记录。", code: "CATALOG_NO_EXISTS" },
      { status: 409 },
    );
  }
  return null;
}

async function resolveLabId(reagentId: string) {
  if (isDemoMode()) {
    const context = demoGetReagentLabId(reagentId);
    if (!context) {
      throw new Error("REAGENT_NOT_FOUND");
    }
    return context.labId;
  }
  const context = await getReagentAccessContext(reagentId);
  return context.labId;
}

export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const user = await requireUserFromRequest(req);
    const { reagentId } = await params;
    const parsed = reagentUpdateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", code: "INVALID_PAYLOAD" }, { status: 400 });
    }
    const labId = await resolveLabId(reagentId);
    await assertLabAccess(user.id, labId);
    if (isDemoMode()) {
      const out = demoUpdateReagent(reagentId, parsed.data);
      if ("error" in out) {
        const status = out.code === "REAGENT_NOT_FOUND" ? 404 : 409;
        return NextResponse.json({ error: out.error, code: out.code }, { status });
      }
      return NextResponse.json({ item: out });
    }
    const item = await updateReagent(reagentId, parsed.data);
    return NextResponse.json({ item });
  } catch (error) {
    const mapped = toErrorResponse(error);
    if (mapped) return mapped;
    console.error("[reagents/update] failed:", error);
    return NextResponse.json({ error: "Failed to update reagent", code: "REAGENT_UPDATE_FAILED" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: RouteParams) {
  try {
    const user = await requireUserFromRequest(req);
    const { reagentId } = await params;
    const labId = await resolveLabId(reagentId);
    await assertLabAccess(user.id, labId);
    if (isDemoMode()) {
      const out = demoDeleteReagent(reagentId);
      if ("error" in out) {
        return NextResponse.json({ error: out.error, code: out.code }, { status: 404 });
      }
      return NextResponse.json(out);
    }
    const out = await deleteReagent(reagentId);
    return NextResponse.json(out);
  } catch (error) {
    const mapped = toErrorResponse(error);
    if (mapped) return mapped;
    console.error("[reagents/delete] failed:", error);
    return NextResponse.json({ error: "Failed to delete reagent", code: "REAGENT_DELETE_FAILED" }, { status: 500 });
  }
}
