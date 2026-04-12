import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertLabAccess } from "@/lib/permissions";
import { requireUserFromRequest } from "@/lib/session";
import { isDemoMode } from "@/lib/demo-mode";
import { demoListReagents } from "@/lib/demo-store";

export const dynamic = "force-dynamic";

const schema = z.object({ labId: z.string().min(1) });

export async function GET(req: Request) {
  try {
    const user = await requireUserFromRequest(req);
    const { searchParams } = new URL(req.url);
    const parsed = schema.safeParse({ labId: searchParams.get("labId") });
    if (!parsed.success) {
      return NextResponse.json({ error: "Missing labId", code: "MISSING_LAB_ID" }, { status: 400 });
    }
    if (isDemoMode()) {
      return NextResponse.json({ items: demoListReagents(parsed.data.labId) });
    }
    await assertLabAccess(user.id, parsed.data.labId);
    const items = await prisma.reagent.findMany({
      where: { labId: parsed.data.labId },
      include: { antibodyMeta: true, primerMeta: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    if (message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }
    if (message === "NO_LAB_ACCESS") {
      return NextResponse.json({ error: "No lab access", code: "NO_LAB_ACCESS" }, { status: 403 });
    }
    if (error instanceof Prisma.PrismaClientValidationError && message.includes("Unknown field `primerMeta`")) {
      return NextResponse.json(
        { error: "Prisma client is outdated. Please restart the dev server.", code: "PRISMA_CLIENT_OUTDATED" },
        { status: 500 },
      );
    }
    console.error("[reagents/list] failed:", error);
    return NextResponse.json({ error: "Failed to load reagents", code: "REAGENTS_LOAD_FAILED" }, { status: 500 });
  }
}
