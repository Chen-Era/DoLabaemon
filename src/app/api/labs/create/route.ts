import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserFromRequest } from "@/lib/session";
import { isDemoMode } from "@/lib/demo-mode";
import { demoCreateLab } from "@/lib/demo-store";

const schema = z.object({
  name: z.string().min(2),
});

export async function POST(req: Request) {
  try {
    const user = await requireUserFromRequest(req);
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", code: "INVALID_PAYLOAD" }, { status: 400 });
    }

    if (isDemoMode()) {
      const result = demoCreateLab({ userId: user.id, name: parsed.data.name });
      if ("error" in result) {
        return NextResponse.json({ error: result.error, code: result.code }, { status: 400 });
      }
      return NextResponse.json(result);
    }

    const lab = await prisma.lab.create({
      data: {
        name: parsed.data.name.trim(),
        members: {
          create: {
            userId: user.id,
            role: "PI",
          },
        },
      },
    });

    return NextResponse.json({ labId: lab.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    if (message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }
    console.error("[labs/create] failed:", error);
    return NextResponse.json({ error: "创建实验室失败", code: "LAB_CREATE_FAILED" }, { status: 500 });
  }
}
