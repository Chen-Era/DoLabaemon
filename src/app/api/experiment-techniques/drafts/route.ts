import { NextResponse } from "next/server";
import { z } from "zod";

import {
  createTechniqueDraft,
  listTechniqueDrafts,
} from "@/lib/experiment-techniques/governance";
import { assertLabAccess } from "@/lib/permissions";
import { requireUserFromRequest } from "@/lib/session";

const createSchema = z.object({
  labId: z.string().trim().min(1),
  baseCode: z.string().trim().min(1).nullable().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  source: z.enum(["CURATED", "AI_DRAFT"]).default("CURATED"),
});

export async function GET(request: Request) {
  try {
    const user = await requireUserFromRequest(request);
    const labId = new URL(request.url).searchParams.get("labId")?.trim();
    if (!labId) {
      return NextResponse.json(
        { error: "Missing labId", code: "MISSING_LAB_ID" },
        { status: 400 },
      );
    }
    await assertLabAccess(user.id, labId);
    return NextResponse.json({ items: await listTechniqueDrafts(labId) });
  } catch (error) {
    return draftError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUserFromRequest(request);
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", code: "INVALID_PAYLOAD" },
        { status: 400 },
      );
    }
    await assertLabAccess(user.id, parsed.data.labId);
    const draft = await createTechniqueDraft({
      ...parsed.data,
      userId: user.id,
    });
    return NextResponse.json({ draft }, { status: 201 });
  } catch (error) {
    return draftError(error);
  }
}

function draftError(error: unknown) {
  const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
  if (message === "UNAUTHORIZED") {
    return NextResponse.json(
      { error: "Unauthorized", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }
  if (message === "NO_LAB_ACCESS") {
    return NextResponse.json(
      { error: "Forbidden", code: "NO_LAB_ACCESS" },
      { status: 403 },
    );
  }
  if (message === "BASE_TECHNIQUE_NOT_FOUND") {
    return NextResponse.json(
      { error: "Base technique not found", code: message },
      { status: 404 },
    );
  }
  console.error("[technique-drafts] failed", error);
  return NextResponse.json(
    { error: "Draft operation failed", code: "DRAFT_OPERATION_FAILED" },
    { status: 500 },
  );
}
