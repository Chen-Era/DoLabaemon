import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUserFromRequest } from "@/lib/session";
import { isDemoMode } from "@/lib/demo-mode";
import { demoLabsOf } from "@/lib/demo-store";
import { listReagents } from "@/lib/reagent-list";

export const dynamic = "force-dynamic";

/**
 * Returns the data needed to render the initial reagent list in one request.
 * Subsequent lab switches continue to use the focused list endpoint.
 */
export async function GET(req: Request) {
  try {
    const user = await requireUserFromRequest(req);

    if (isDemoMode()) {
      const labs = demoLabsOf(user.id);
      const labId = labs[0]?.lab.id ?? null;
      const result = labId ? await listReagents(prisma, labId) : null;
      return NextResponse.json({
        labs,
        labId,
        ...(result ?? { items: [], total: 0, page: 1, pageSize: 50, availableTags: [] }),
      });
    }

    const labs = await prisma.labMember.findMany({
      where: { userId: user.id },
      include: { lab: true },
    });
    const labId = labs[0]?.lab.id ?? null;
    const result = labId ? await listReagents(prisma, labId) : null;

    return NextResponse.json({
      labs,
      labId,
      ...(result ?? { items: [], total: 0, page: 1, pageSize: 50, availableTags: [] }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    if (message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }
    if (error instanceof Prisma.PrismaClientValidationError && message.includes("Unknown field `primerMeta`")) {
      return NextResponse.json(
        { error: "Prisma client is outdated. Please restart the dev server.", code: "PRISMA_CLIENT_OUTDATED" },
        { status: 500 },
      );
    }
    console.error("[reagents/bootstrap] failed:", error);
    return NextResponse.json({ error: "Failed to load reagents", code: "REAGENTS_BOOTSTRAP_FAILED" }, { status: 500 });
  }
}
