import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { canReviewJoinRequests } from "@/lib/permissions";
import { requireUserFromRequest } from "@/lib/session";
import { isDemoMode } from "@/lib/demo-mode";
import { demoReviewJoinRequest } from "@/lib/demo-store";

const reviewSchema = z.object({
  action: z.enum(["approve", "reject"]),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ requestId: string }> }) {
  try {
    const user = await requireUserFromRequest(req);
    const { requestId } = await params;
    const parsed = reviewSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", code: "INVALID_PAYLOAD" }, { status: 400 });
    }

    if (isDemoMode()) {
      const result = demoReviewJoinRequest({
        requestId,
        reviewerId: user.id,
        action: parsed.data.action,
      });
      if ("error" in result) {
        const status = result.code === "PERMISSION_DENIED" ? 403 : 404;
        return NextResponse.json({ error: result.error, code: result.code }, { status });
      }
      return NextResponse.json(result);
    }

    const joinRequest = await prisma.labJoinRequest.findUnique({ where: { id: requestId } });
    if (!joinRequest || joinRequest.status !== "PENDING") {
      return NextResponse.json({ error: "申请不存在或已处理", code: "REQUEST_NOT_FOUND" }, { status: 404 });
    }
    const membership = await prisma.labMember.findUnique({
      where: { userId_labId: { userId: user.id, labId: joinRequest.labId } },
    });
    if (!membership || !canReviewJoinRequests(membership.role)) {
      return NextResponse.json({ error: "Permission denied", code: "PERMISSION_DENIED" }, { status: 403 });
    }

    const status = parsed.data.action === "approve" ? "APPROVED" : "REJECTED";
    await prisma.$transaction(async (tx) => {
      if (parsed.data.action === "approve") {
        await tx.labMember.upsert({
          where: { userId_labId: { userId: joinRequest.userId, labId: joinRequest.labId } },
          update: {},
          create: { userId: joinRequest.userId, labId: joinRequest.labId, role: "MEMBER" },
        });
      }
      await tx.labJoinRequest.update({
        where: { id: joinRequest.id },
        data: { status, reviewedAt: new Date(), reviewerId: user.id },
      });
    });

    return NextResponse.json({ joinRequestId: joinRequest.id, status, labId: joinRequest.labId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    if (message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }
    console.error("[labs/join-requests/:id] PATCH failed:", error);
    return NextResponse.json({ error: "审批失败", code: "JOIN_REQUEST_REVIEW_FAILED" }, { status: 500 });
  }
}
