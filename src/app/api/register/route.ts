import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { isDemoMode } from "@/lib/demo-mode";
import { demoRegister } from "@/lib/demo-store";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  displayName: z.string().optional(),
  mode: z.enum(["create", "invite", "request", "none"]).optional(),
  labName: z.string().optional(),
  inviteCode: z.string().optional(),
  requestLabId: z.string().optional(),
  requestMessage: z.string().max(500).optional(),
});

function errorResponse(error: string, code: string, status: number) {
  return NextResponse.json({ error, code }, { status });
}

function isDatabaseUnavailable(error: unknown) {
  return (
    (error instanceof Prisma.PrismaClientInitializationError && error.errorCode === "P1001") ||
    (error instanceof Error && error.message.includes("Can't reach database server"))
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("Invalid payload", "INVALID_PAYLOAD", 400);
    }
    const mode = parsed.data.mode ?? "create";
    if (mode === "create" && (!parsed.data.labName || parsed.data.labName.trim().length < 2)) {
      return errorResponse("实验室名称至少 2 个字符", "INVALID_PAYLOAD", 400);
    }
    if (mode === "invite" && !parsed.data.inviteCode?.trim()) {
      return errorResponse("请输入邀请码", "INVALID_PAYLOAD", 400);
    }
    if (mode === "request" && !parsed.data.requestLabId) {
      return errorResponse("请选择要申请加入的实验室", "INVALID_PAYLOAD", 400);
    }
    if (isDemoMode()) {
      const demo = await demoRegister({
        email: parsed.data.email,
        password: parsed.data.password,
        displayName: parsed.data.displayName,
        labName: parsed.data.labName,
        mode,
        inviteCode: parsed.data.inviteCode,
        requestLabId: parsed.data.requestLabId,
        requestMessage: parsed.data.requestMessage,
      });
      if ("error" in demo) {
        return errorResponse(demo.error, demo.code, demo.code === "EMAIL_EXISTS" ? 409 : 400);
      }
      const response = NextResponse.json(demo);
      response.cookies.set("demo_user_id", demo.userId, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 30 * 24 * 3600,
      });
      return response;
    }

    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (existing) {
      return errorResponse("Email already exists", "EMAIL_EXISTS", 409);
    }

    const passwordHash = await hashPassword(parsed.data.password);

    if (mode === "invite") {
      const invite = await prisma.invitation.findUnique({
        where: { id: parsed.data.inviteCode!.trim() },
      });
      if (!invite) {
        return errorResponse("邀请码无效", "INVITE_NOT_FOUND", 404);
      }
      if (invite.expiresAt < new Date()) {
        return errorResponse("邀请已过期，请让负责人重新邀请", "INVITE_EXPIRED", 400);
      }
      if (invite.email.toLowerCase() !== parsed.data.email.toLowerCase()) {
        return errorResponse("该邀请码绑定的是其他邮箱", "INVITE_EMAIL_MISMATCH", 403);
      }
      if (invite.role === "PI") {
        return errorResponse("负责人角色不能通过邀请码授予", "INVALID_INVITE_ROLE", 400);
      }
      const created = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: parsed.data.email,
            displayName: parsed.data.displayName,
            passwordHash,
            memberships: {
              create: { labId: invite.labId, role: invite.role },
            },
          },
        });
        await tx.invitation.delete({ where: { id: invite.id } });
        return user;
      });
      return NextResponse.json({ userId: created.id, labId: invite.labId, mode });
    }

    if (mode === "request") {
      const lab = await prisma.lab.findUnique({ where: { id: parsed.data.requestLabId! } });
      if (!lab) {
        return errorResponse("没有找到这个实验室", "LAB_NOT_FOUND", 404);
      }
      const created = await prisma.user.create({
        data: {
          email: parsed.data.email,
          displayName: parsed.data.displayName,
          passwordHash,
          joinRequests: {
            create: {
              labId: lab.id,
              message: parsed.data.requestMessage?.trim() || null,
            },
          },
        },
        include: { joinRequests: true },
      });
      return NextResponse.json({
        userId: created.id,
        joinRequestId: created.joinRequests[0]?.id,
        mode,
      });
    }

    if (mode === "none") {
      const created = await prisma.user.create({
        data: {
          email: parsed.data.email,
          displayName: parsed.data.displayName,
          passwordHash,
        },
      });
      return NextResponse.json({ userId: created.id, mode });
    }

    const created = await prisma.user.create({
      data: {
        email: parsed.data.email,
        displayName: parsed.data.displayName,
        passwordHash,
        memberships: {
          create: {
            role: "PI",
            lab: { create: { name: parsed.data.labName!.trim() } },
          },
        },
      },
      include: { memberships: true },
    });

    return NextResponse.json({ userId: created.id, labId: created.memberships[0]?.labId, mode });
  } catch (error) {
    console.error("[register] failed:", error);
    if (isDatabaseUnavailable(error)) {
      return NextResponse.json(
        {
          error: "数据库当前不可用，请先启动 PostgreSQL；如果只想本地体验并保存数据，可把 DEMO_MODE 改为 true。",
          code: "DATABASE_UNAVAILABLE",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: "Internal server error", code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
