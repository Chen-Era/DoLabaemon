import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserFromRequest } from "@/lib/session";
import { isDemoMode } from "@/lib/demo-mode";
import { demoConfirmExperimentResolution } from "@/lib/demo-store";

const schema = z.object({
  draftId: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    await requireUserFromRequest(req);
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", code: "INVALID_PAYLOAD" }, { status: 400 });
    }

    if (isDemoMode()) {
      const output = demoConfirmExperimentResolution(parsed.data.draftId);
      if ("error" in output) {
        return NextResponse.json({ error: output.error, code: output.code }, { status: 400 });
      }
      return NextResponse.json(output);
    }

    const draft = await prisma.experimentResolveDraft.findUnique({ where: { id: parsed.data.draftId } });
    if (!draft || draft.isConfirmed) {
      return NextResponse.json({ error: "Invalid draft", code: "INVALID_DRAFT" }, { status: 400 });
    }
    await prisma.experimentResolveDraft.update({
      where: { id: draft.id },
      data: { isConfirmed: true },
    });
    return NextResponse.json({ draftId: draft.id, confirmed: true, resolvedOutput: draft.resolvedOutput });
  } catch {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }
}
