import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserFromRequest } from "@/lib/session";
import { isDemoMode } from "@/lib/demo-mode";
import { demoCreateJoinRequest, demoListJoinRequests } from "@/lib/demo-store";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  labId: z.string().min(1),
  message: z.string().max(500).optional(),
});

export async function GET(req: Request) {
  try {
    const user = await requireUserFromRequest(req);
    if (isDemoMode()) {
      return NextResponse.json(demoListJoinRequests(user.id));
    }
    const [mine, pending] = await Promise.all([
      prisma.labJoinRequest.findMany({
        where: { userId: user.id },
        include: { lab: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.labJoinRequest.findMany({
        where: {
          status: "PENDING",
          lab: { members: { some: { userId: user.id, role: { in: ["PI", "ADMIN"] } } } },
        },
        include: {
          lab: { select: { id: true, name: true } },
          user: { select: { id: true, email: true, displayName: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    return NextResponse.json({ mine, pending });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    if (message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }
    console.error("[labs/join-requests] GET failed:", error);
    return NextResponse.json({ error: "加载加入申请失败", code: "JOIN_REQUESTS_LOAD_FAILED" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUserFromRequest(req);
    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", code: "INVALID_PAYLOAD" }, { status: 400 });
    }

    if (isDemoMode()) {
      const result = demoCreateJoinRequest({
        userId: user.id,
        labId: parsed.data.labId,
        message: parsed.data.message,
      });
      if ("error" in result) {
        const status = result.code === "LAB_NOT_FOUND" ? 404 : result.code === "ALREADY_IN_LAB" ? 409 : 400;
        return NextResponse.json({ error: result.error, code: result.code }, { status });
      }
      return NextResponse.json(result);
    }

    const lab = await prisma.lab.findUnique({ where: { id: parsed.data.labId } });
    if (!lab) {
      return NextResponse.json({ error: "没有找到这个实验室", code: "LAB_NOT_FOUND" }, { status: 404 });
    }
    const membership = await prisma.labMember.findUnique({
      where: { userId_labId: { userId: user.id, labId: lab.id } },
    });
    if (membership) {
      return NextResponse.json({ error: "你已加入该实验室", code: "ALREADY_IN_LAB" }, { status: 409 });
    }
    const existing = await prisma.labJoinRequest.findFirst({
      where: { userId: user.id, labId: lab.id, status: "PENDING" },
    });
    if (existing) {
      return NextResponse.json(
        { error: "你已经提交过申请，请等待审批", code: "REQUEST_ALREADY_PENDING" },
        { status: 409 },
      );
    }

    const joinRequest = await prisma.labJoinRequest.create({
      data: {
        labId: lab.id,
        userId: user.id,
        message: parsed.data.message?.trim() || null,
      },
    });
    return NextResponse.json({ joinRequestId: joinRequest.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    if (message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }
    console.error("[labs/join-requests] POST failed:", error);
    return NextResponse.json({ error: "提交加入申请失败", code: "JOIN_REQUEST_FAILED" }, { status: 500 });
  }
}
