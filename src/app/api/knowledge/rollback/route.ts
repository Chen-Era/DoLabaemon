import { NextResponse } from "next/server";
import { z } from "zod";
import { assertLabAccess } from "@/lib/permissions";
import { getKnowledgeMutationLog } from "@/lib/knowledge/logs";
import { rollbackKnowledgeMutation } from "@/lib/knowledge/mutations/rollback";
import { requireUserFromRequest } from "@/lib/session";

const schema = z.object({
  logId: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const user = await requireUserFromRequest(req);
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", code: "INVALID_PAYLOAD" }, { status: 400 });
    }
    const log = await getKnowledgeMutationLog(parsed.data.logId);
    if (!log) {
      return NextResponse.json({ error: "Log not found", code: "LOG_NOT_FOUND" }, { status: 404 });
    }
    await assertLabAccess(user.id, log.labId);
    return NextResponse.json(await rollbackKnowledgeMutation(parsed.data.logId));
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "NO_LAB_ACCESS") {
      return NextResponse.json({ error: "Forbidden", code: "NO_LAB_ACCESS" }, { status: 403 });
    }
    return NextResponse.json({ error: "Rollback failed", code: "ROLLBACK_FAILED" }, { status: 500 });
  }
}
