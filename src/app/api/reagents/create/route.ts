import { NextResponse } from "next/server";
import { assertLabAccess } from "@/lib/permissions";
import { requireUserFromRequest } from "@/lib/session";
import { isDemoMode } from "@/lib/demo-mode";
import { demoCreateReagent } from "@/lib/demo-store";
import { createReagent } from "@/lib/reagent-manage/manage-reagents";
import { reagentCreateSchema } from "@/lib/reagent-manage/types";

export async function POST(req: Request) {
  try {
    const user = await requireUserFromRequest(req);
    const parsed = reagentCreateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", code: "INVALID_PAYLOAD" }, { status: 400 });
    }
    await assertLabAccess(user.id, parsed.data.labId);
    if (isDemoMode()) {
      const out = demoCreateReagent(parsed.data, user);
      if ("error" in out) {
        return NextResponse.json({ error: out.error, code: out.code }, { status: 409 });
      }
      return NextResponse.json({ item: out }, { status: 201 });
    }
    const item = await createReagent(parsed.data, user);
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    if (message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }
    if (message === "NO_LAB_ACCESS") {
      return NextResponse.json({ error: "No lab access", code: "NO_LAB_ACCESS" }, { status: 403 });
    }
    if (message === "CATALOG_NO_EXISTS") {
      return NextResponse.json(
        { error: "该货号在当前实验室已存在，可直接编辑原有记录。", code: "CATALOG_NO_EXISTS" },
        { status: 409 },
      );
    }
    console.error("[reagents/create] failed:", error);
    return NextResponse.json({ error: "Failed to create reagent", code: "REAGENT_CREATE_FAILED" }, { status: 500 });
  }
}
