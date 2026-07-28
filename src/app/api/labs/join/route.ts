import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserFromRequest } from "@/lib/session";
import { isDemoMode } from "@/lib/demo-mode";
import { demoJoinLab } from "@/lib/demo-store";

const schema = z.object({
  inviteId: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const user = await requireUserFromRequest(req);
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", code: "INVALID_PAYLOAD" }, { status: 400 });
    }

    if (isDemoMode()) {
      const result = demoJoinLab({
        userId: user.id,
        email: user.email ?? undefined,
        inviteId: parsed.data.inviteId,
      });
      if ("error" in result) {
        return NextResponse.json({ error: result.error, code: result.code }, { status: 400 });
      }
      return NextResponse.json(result);
    }

    if (!user.email) {
      return NextResponse.json({ error: "当前账号缺少邮箱信息", code: "EMAIL_REQUIRED" }, { status: 400 });
    }

    const invite = await prisma.invitation.findUnique({
      where: { id: parsed.data.inviteId },
    });

    if (!invite) {
      return NextResponse.json({ error: "邀请不存在", code: "INVITE_NOT_FOUND" }, { status: 404 });
    }
    if (invite.expiresAt < new Date()) {
      return NextResponse.json({ error: "邀请已过期", code: "INVITE_EXPIRED" }, { status: 400 });
    }
    if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
      return NextResponse.json({ error: "该邀请不属于当前账号", code: "INVITE_EMAIL_MISMATCH" }, { status: 403 });
    }
    if (invite.role === "PI") {
      return NextResponse.json({ error: "负责人角色不能通过邀请码授予", code: "INVALID_INVITE_ROLE" }, { status: 400 });
    }

    const existing = await prisma.labMember.findUnique({
      where: { userId_labId: { userId: user.id, labId: invite.labId } },
    });
    if (existing) {
      return NextResponse.json({ error: "你已加入该实验室", code: "ALREADY_IN_LAB" }, { status: 409 });
    }

    await prisma.labMember.create({
      data: {
        userId: user.id,
        labId: invite.labId,
        role: invite.role,
      },
    });
    await prisma.invitation.delete({ where: { id: invite.id } });

    return NextResponse.json({ labId: invite.labId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    if (message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }
    console.error("[labs/join] failed:", error);
    return NextResponse.json({ error: "加入实验室失败", code: "LAB_JOIN_FAILED" }, { status: 500 });
  }
}
