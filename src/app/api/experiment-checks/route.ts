import { NextResponse } from "next/server";
import { z } from "zod";

import { isDemoMode } from "@/lib/demo-mode";
import { evaluateTechniqueReadiness } from "@/lib/experiment-techniques/check";
import { listInventoryCapabilities } from "@/lib/experiment-techniques/inventory";
import { getPublishedTechnique } from "@/lib/experiment-techniques/runtime";
import { assertLabAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireUserFromRequest } from "@/lib/session";

const schema = z.object({
  labId: z.string().trim().min(1),
  techniqueCode: z.string().trim().min(1),
  profileCode: z.string().trim().min(1).nullable().optional(),
  directionCode: z.string().trim().min(1).nullable().optional(),
  confirmedRequirementIds: z.array(z.string().trim().min(1)).default([]),
  notApplicableRequirementIds: z.array(z.string().trim().min(1)).default([]),
});

export async function POST(request: Request) {
  try {
    const user = await requireUserFromRequest(request);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", code: "INVALID_PAYLOAD", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    await assertLabAccess(user.id, parsed.data.labId);
    const technique = await getPublishedTechnique(parsed.data.techniqueCode);
    if (!technique) {
      return NextResponse.json({
        techniqueCode: parsed.data.techniqueCode,
        profileCode: parsed.data.profileCode ?? null,
        directionCode: parsed.data.directionCode ?? null,
        direction: null,
        status: "UNSUPPORTED",
        items: [],
        reasons: ["Technique does not exist in the available catalog."],
      });
    }

    const result = evaluateTechniqueReadiness({
      technique,
      profileCode: parsed.data.profileCode,
      directionCode: parsed.data.directionCode,
      confirmedRequirementIds: parsed.data.confirmedRequirementIds,
      notApplicableRequirementIds: parsed.data.notApplicableRequirementIds,
      inventory: await listInventoryCapabilities(parsed.data.labId),
    });

    let checkRunId: string | null = null;
    if (!isDemoMode()) {
      const checkRun = await prisma.experimentCheckRun.create({
        data: {
          labId: parsed.data.labId,
          userId: user.id,
          experimentCode: technique.code,
          profileCode: parsed.data.profileCode ?? null,
          directionCode: parsed.data.directionCode ?? null,
          techniqueRevision: technique.revision,
          confirmedRequirementIds: parsed.data.confirmedRequirementIds,
          confidenceLabel: "HIGH",
          status: result.status,
          warnings: result.reasons,
          compatibilityIssues: [],
          items: {
            create: result.items.map((item) => ({
              level:
                item.level === "RECOMMENDED" ? "RECOMMENDED" : "MIN_REQUIRED",
              displayName: item.label,
              isMissing:
                item.state === "MISSING" || item.state === "UNCONFIRMED",
              matchedName: item.matchedName,
              requirementId: item.requirementId,
              requirementKind: item.kind,
              requirementLevel: item.level,
              verificationMode: item.verificationMode,
              state: item.state,
            })),
          },
        },
      });
      checkRunId = checkRun.id;
    }

    return NextResponse.json({ ...result, checkRunId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    if (message === "UNAUTHORIZED") {
      return NextResponse.json(
        { error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 },
      );
    }
    if (message === "NO_LAB_ACCESS") {
      return NextResponse.json(
        { error: "No lab access", code: "NO_LAB_ACCESS" },
        { status: 403 },
      );
    }
    console.error("[experiment-checks] failed", error);
    return NextResponse.json(
      { error: "Technique check failed", code: "TECHNIQUE_CHECK_FAILED" },
      { status: 500 },
    );
  }
}
