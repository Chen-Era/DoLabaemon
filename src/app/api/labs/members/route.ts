import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertLabAccess, canRemoveMember } from "@/lib/permissions";
import { requireUserFromRequest } from "@/lib/session";
import { isDemoMode } from "@/lib/demo-mode";
import { demoListLabMembers, demoRemoveLabMember } from "@/lib/demo-store";

export const dynamic = "force-dynamic";

const removeSchema = z.object({
  labId: z.string().min(1),
  userId: z.string().min(1),
});

function toErrorResponse(error: unknown, fallback: { error: string; code: string }) {
  const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
  if (message === "UNAUTHORIZED") {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }
  if (message === "NO_LAB_ACCESS") {
    return NextResponse.json({ error: "当前账号没有该实验室的访问权限", code: "NO_LAB_ACCESS" }, { status: 403 });
  }
  console.error("[labs/members] failed:", error);
  return NextResponse.json(fallback, { status: 500 });
}

export async function GET(req: Request) {
  try {
    const user = await requireUserFromRequest(req);
    const labId = new URL(req.url).searchParams.get("labId") ?? "";
    if (!labId) {
      return NextResponse.json({ error: "Invalid payload", code: "INVALID_PAYLOAD" }, { status: 400 });
    }
    if (isDemoMode()) {
      await assertLabAccess(user.id, labId);
      return NextResponse.json({ items: demoListLabMembers(labId) });
    }
    await assertLabAccess(user.id, labId);
    const members = await prisma.labMember.findMany({
      where: { labId },
      include: { user: { select: { id: true, email: true, displayName: true } } },
      orderBy: { role: "asc" },
    });
    return NextResponse.json({
      items: members.map((member) => ({
        userId: member.userId,
        role: member.role,
        email: member.user.email,
        displayName: member.user.displayName,
      })),
    });
  } catch (error) {
    return toErrorResponse(error, { error: "加载成员失败", code: "MEMBERS_LOAD_FAILED" });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await requireUserFromRequest(req);
    const parsed = removeSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", code: "INVALID_PAYLOAD" }, { status: 400 });
    }

    if (isDemoMode()) {
      const result = demoRemoveLabMember({
        actorId: user.id,
        labId: parsed.data.labId,
        targetUserId: parsed.data.userId,
      });
      if ("error" in result) {
        const status = result.code === "PERMISSION_DENIED" ? 403 : result.code === "MEMBER_NOT_FOUND" ? 404 : 400;
        return NextResponse.json({ error: result.error, code: result.code }, { status });
      }
      return NextResponse.json(result);
    }

    const actor = await assertLabAccess(user.id, parsed.data.labId);
    const target = await prisma.labMember.findUnique({
      where: { userId_labId: { userId: parsed.data.userId, labId: parsed.data.labId } },
    });
    if (!target) {
      return NextResponse.json({ error: "该成员不在实验室中", code: "MEMBER_NOT_FOUND" }, { status: 404 });
    }
    if (!canRemoveMember(actor.role, target.role, parsed.data.userId === user.id)) {
      return NextResponse.json({ error: "Permission denied", code: "PERMISSION_DENIED" }, { status: 403 });
    }
    await prisma.labMember.delete({ where: { id: target.id } });
    return NextResponse.json({ removedUserId: parsed.data.userId });
  } catch (error) {
    return toErrorResponse(error, { error: "移除成员失败", code: "MEMBER_REMOVE_FAILED" });
  }
}
