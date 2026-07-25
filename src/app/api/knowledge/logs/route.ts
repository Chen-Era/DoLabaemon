import { NextResponse } from "next/server";
import { assertLabAccess } from "@/lib/permissions";
import { listKnowledgeMutationLogs } from "@/lib/knowledge/logs";
import { requireUserFromRequest } from "@/lib/session";

export async function GET(req: Request) {
  try {
    const user = await requireUserFromRequest(req);
    const { searchParams } = new URL(req.url);
    const labId = searchParams.get("labId")?.trim();
    if (!labId) {
      return NextResponse.json({ error: "Missing labId", code: "MISSING_LAB_ID" }, { status: 400 });
    }
    await assertLabAccess(user.id, labId);
    return NextResponse.json({ items: await listKnowledgeMutationLogs(labId) });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "NO_LAB_ACCESS") {
      return NextResponse.json({ error: "Forbidden", code: "NO_LAB_ACCESS" }, { status: 403 });
    }
    return NextResponse.json({ error: "Load knowledge logs failed", code: "LOAD_KNOWLEDGE_LOGS_FAILED" }, { status: 500 });
  }
}
