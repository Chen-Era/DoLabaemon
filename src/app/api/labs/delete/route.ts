import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertLabAccess, canDeleteLab } from "@/lib/permissions";
import { requireUserFromRequest } from "@/lib/session";
import { isDemoMode } from "@/lib/demo-mode";
import { demoDeleteLab } from "@/lib/demo-store";

const schema = z.object({
  labId: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const user = await requireUserFromRequest(req);
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", code: "INVALID_PAYLOAD" }, { status: 400 });
    }

    if (isDemoMode()) {
      const result = demoDeleteLab({ userId: user.id, labId: parsed.data.labId });
      if ("error" in result) {
        return NextResponse.json({ error: result.error, code: result.code }, { status: 403 });
      }
      return NextResponse.json(result);
    }

    const membership = await assertLabAccess(user.id, parsed.data.labId);
    if (!canDeleteLab(membership.role)) {
      return NextResponse.json(
        { error: "只有负责人（PI）可以删除实验室", code: "PERMISSION_DENIED" },
        { status: 403 },
      );
    }

    await prisma.lab.delete({ where: { id: parsed.data.labId } });
    return NextResponse.json({ deletedLabId: parsed.data.labId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    if (message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }
    if (message === "NO_LAB_ACCESS") {
      return NextResponse.json({ error: "当前账号没有该实验室的访问权限", code: "NO_LAB_ACCESS" }, { status: 403 });
    }
    console.error("[labs/delete] failed:", error);
    return NextResponse.json({ error: "删除实验室失败", code: "LAB_DELETE_FAILED" }, { status: 500 });
  }
}
