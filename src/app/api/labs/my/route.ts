import { NextResponse } from "next/server";
import { requireUserFromRequest } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { isDemoMode } from "@/lib/demo-mode";
import { demoLabsOf } from "@/lib/demo-store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = await requireUserFromRequest(req);
    if (isDemoMode()) {
      return NextResponse.json({ items: demoLabsOf(user.id) });
    }
    const items = await prisma.labMember.findMany({
      where: { userId: user.id },
      include: { lab: true },
    });
    return NextResponse.json({ items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    if (message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }
    console.error("[labs/my] failed:", error);
    return NextResponse.json({ error: "Failed to load labs", code: "LABS_LOAD_FAILED" }, { status: 500 });
  }
}
