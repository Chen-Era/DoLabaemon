import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertLabAccess } from "@/lib/permissions";
import { requireUserFromRequest } from "@/lib/session";
import { listReagents, reagentListSortKeys } from "@/lib/reagent-list";

export const dynamic = "force-dynamic";

const schema = z.object({
  labId: z.string().min(1),
  page: z.coerce.number().int().positive().catch(1),
  query: z.string().catch(""),
  tag: z.string().catch("").transform((value) => value || null),
  sort: z.enum(reagentListSortKeys).catch("uploadedAt"),
  direction: z.enum(["asc", "desc"]).catch("desc"),
});

export async function GET(req: Request) {
  try {
    const user = await requireUserFromRequest(req);
    const { searchParams } = new URL(req.url);
    const parsed = schema.safeParse({
      labId: searchParams.get("labId"),
      page: searchParams.get("page") ?? undefined,
      query: searchParams.get("query") ?? undefined,
      tag: searchParams.get("tag") ?? undefined,
      sort: searchParams.get("sort") ?? undefined,
      direction: searchParams.get("direction") ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: "Missing labId", code: "MISSING_LAB_ID" }, { status: 400 });
    }
    await assertLabAccess(user.id, parsed.data.labId);
    const result = await listReagents(prisma, parsed.data.labId, {
      page: parsed.data.page,
      query: parsed.data.query,
      tag: parsed.data.tag,
      sort: parsed.data.sort,
      direction: parsed.data.direction,
    });
    return NextResponse.json(result);
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
