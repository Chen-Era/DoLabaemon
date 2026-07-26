import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertLabAccess, canInvite } from "@/lib/permissions";
import { requireUserFromRequest } from "@/lib/session";
import { isDemoMode } from "@/lib/demo-mode";
import { demoCreateInvite, demoListInvites } from "@/lib/demo-store";

export const dynamic = "force-dynamic";

const schema = z.object({
  labId: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["PI", "ADMIN", "MEMBER"]),
});

export async function GET(req: Request) {
  try {
    const user = await requireUserFromRequest(req);
    const labId = new URL(req.url).searchParams.get("labId") ?? "";
    if (!labId) {
      return NextResponse.json({ error: "Invalid payload", code: "INVALID_PAYLOAD" }, { status: 400 });
    }
    const membership = await assertLabAccess(user.id, labId);
    if (!canInvite(membership.role)) {
      return NextResponse.json({ error: "Permission denied", code: "PERMISSION_DENIED" }, { status: 403 });
    }
    if (isDemoMode()) {
      return NextResponse.json({ items: demoListInvites(labId) });
    }
    const items = await prisma.invitation.findMany({
      where: { labId, expiresAt: { gt: new Date() } },
      orderBy: { expiresAt: "asc" },
      select: { id: true, email: true, role: true, expiresAt: true },
    });
    return NextResponse.json({ items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    if (message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }
    if (message === "NO_LAB_ACCESS") {
      return NextResponse.json({ error: "当前账号没有该实验室的访问权限", code: "NO_LAB_ACCESS" }, { status: 403 });
    }
    console.error("[labs/invite] GET failed:", error);
    return NextResponse.json({ error: "加载邀请失败", code: "INVITES_LOAD_FAILED" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUserFromRequest(req);
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", code: "INVALID_PAYLOAD" }, { status: 400 });
    }
    if (isDemoMode()) {
      const out = demoCreateInvite({
        userId: user.id,
        labId: parsed.data.labId,
        email: parsed.data.email,
        role: parsed.data.role,
      });
      if ("error" in out) {
        return NextResponse.json({ error: out.error, code: out.code }, { status: 403 });
      }
      return NextResponse.json(out);
    }
    const membership = await assertLabAccess(user.id, parsed.data.labId);
    if (!canInvite(membership.role)) {
      return NextResponse.json({ error: "Permission denied", code: "PERMISSION_DENIED" }, { status: 403 });
    }
    const invite = await prisma.invitation.create({
      data: {
        labId: parsed.data.labId,
        email: parsed.data.email.trim().toLowerCase(),
        role: parsed.data.role,
        invitedById: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      },
      include: { lab: { select: { name: true } } },
    });
    return NextResponse.json({
      inviteId: invite.id,
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt,
      labName: invite.lab.name,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    if (message === "NO_LAB_ACCESS") {
      return NextResponse.json({ error: "当前账号没有该实验室的访问权限", code: "NO_LAB_ACCESS" }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }
}
