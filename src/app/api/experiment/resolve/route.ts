import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertLabAccess } from "@/lib/permissions";
import { requireUserFromRequest } from "@/lib/session";
import { isDemoMode } from "@/lib/demo-mode";
import { demoResolveExperiment } from "@/lib/demo-store";
import { resolveExperimentInput } from "@/lib/experiment/resolve";

const schema = z.object({
  labId: z.string().min(1),
  customExperimentName: z.string().min(1),
  experimentContext: z.string().optional(),
  direction: z.string().optional(),
  prerequisite: z.string().optional(),
  lang: z.enum(["zh", "en"]).default("zh"),
});

export async function POST(req: Request) {
  try {
    const user = await requireUserFromRequest(req);
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", code: "INVALID_PAYLOAD" }, { status: 400 });
    }

    if (isDemoMode()) {
      return NextResponse.json(
        await demoResolveExperiment({
          labId: parsed.data.labId,
          userId: user.id,
          customExperimentName: parsed.data.customExperimentName,
          experimentContext: parsed.data.experimentContext,
          direction: parsed.data.direction,
          lang: parsed.data.lang,
        }),
      );
    }

    await assertLabAccess(user.id, parsed.data.labId);
    const resolution = await resolveExperimentInput({
      customExperimentName: parsed.data.customExperimentName,
      experimentContext: parsed.data.experimentContext,
      directionCode: parsed.data.direction,
      lang: parsed.data.lang,
    });

    let draftId: string | undefined;
    if (resolution.resolutionSource === "MODEL_SUGGESTION" && resolution.suggestion) {
      const draft = await prisma.experimentResolveDraft.create({
        data: {
          labId: parsed.data.labId,
          userId: user.id,
          rawInput: parsed.data,
          resolvedOutput: resolution.suggestion,
          resolutionSource: resolution.resolutionSource,
          confidence: resolution.resolutionConfidence,
          warnings: resolution.warnings,
        },
      });
      draftId = draft.id;
    }

    return NextResponse.json({ ...resolution, draftId });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }
    console.error("[experiment-resolve] request failed:", error);
    return NextResponse.json({ error: "Resolve request failed", code: "RESOLVE_REQUEST_FAILED" }, { status: 500 });
  }
}
