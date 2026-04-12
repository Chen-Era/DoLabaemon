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
  labName: z.string().min(2),
});

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
      return NextResponse.json({ error: "Invalid payload", code: "INVALID_PAYLOAD" }, { status: 400 });
    }
    if (isDemoMode()) {
      const demo = await demoRegister({
        email: parsed.data.email,
        password: parsed.data.password,
        displayName: parsed.data.displayName,
        labName: parsed.data.labName,
      });
      if ("error" in demo) {
        return NextResponse.json({ error: demo.error, code: demo.code }, { status: 409 });
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
      return NextResponse.json({ error: "Email already exists", code: "EMAIL_EXISTS" }, { status: 409 });
    }

    const created = await prisma.user.create({
      data: {
        email: parsed.data.email,
        displayName: parsed.data.displayName,
        passwordHash: await hashPassword(parsed.data.password),
        memberships: {
          create: {
            role: "PI",
            lab: { create: { name: parsed.data.labName } },
          },
        },
      },
      include: { memberships: true },
    });

    return NextResponse.json({ userId: created.id, labId: created.memberships[0]?.labId });
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
