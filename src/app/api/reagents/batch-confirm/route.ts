import { NextResponse } from "next/server";
import { z } from "zod";
import { isDemoMode } from "@/lib/demo-mode";
import { demoConfirmReagent } from "@/lib/demo-store";
import { assertLabAccess } from "@/lib/permissions";
import { requireUserFromRequest } from "@/lib/session";
import { confirmReagentDraft, summarizeBatchConfirmResults } from "@/lib/reagent-ingest/confirm-reagent";
import { confirmDraftItemSchema } from "@/lib/reagent-ingest/types";

const schema = z.object({
  items: z.array(confirmDraftItemSchema).min(1),
});

export async function POST(req: Request) {
  try {
    const user = await requireUserFromRequest(req);
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", code: "INVALID_PAYLOAD" }, { status: 400 });
    }

    if (!isDemoMode()) {
      const labIds = [...new Set(parsed.data.items.map((item) => item.editedPayload.labId))];
      await Promise.all(labIds.map((labId) => assertLabAccess(user.id, labId)));
    }

    const results = await Promise.all(
      parsed.data.items.map(async (item) => {
        try {
          const result = isDemoMode() ? demoConfirmReagent(item) : await confirmReagentDraft(item);
          if ("error" in result) {
            return { ok: false as const, draftId: item.draftId, error: result.error };
          }
          return { ok: true as const, draftId: item.draftId, result };
        } catch (error) {
          return {
            ok: false as const,
            draftId: item.draftId,
            error: error instanceof Error ? error.message : "UNKNOWN_ERROR",
          };
        }
      }),
    );

    return NextResponse.json({
      ...summarizeBatchConfirmResults(results),
      results,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "NO_LAB_ACCESS") {
      return NextResponse.json({ error: "No lab access", code: "NO_LAB_ACCESS" }, { status: 403 });
    }
    console.error("[reagent-batch-confirm] request failed:", error);
    return NextResponse.json({ error: "Batch confirm request failed", code: "BATCH_CONFIRM_REQUEST_FAILED" }, { status: 500 });
  }
}
