import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserFromRequest } from "@/lib/session";
import { assertLabAccess } from "@/lib/permissions";
import { runExperimentCheck } from "@/lib/rules/engine";
import { isDemoMode } from "@/lib/demo-mode";
import { demoCheckExperiment } from "@/lib/demo-store";
import { getRuntimeLlmConfigForUser } from "@/lib/llm/runtime-config";
import { resolveExperimentInput } from "@/lib/experiment/resolve";
import { experimentTypeCatalog } from "@/lib/rules/catalog";

const supportedExperimentCodes = experimentTypeCatalog.map((item) => item.code) as [string, ...string[]];

const standardSchema = z.object({
  labId: z.string().min(1),
  inputMode: z.literal("STANDARD").default("STANDARD"),
  experimentType: z.enum(supportedExperimentCodes),
  direction: z.string().optional(),
  prerequisite: z.string().optional(),
  lang: z.enum(["zh", "en"]).default("zh"),
});

const manualSchema = z.object({
  labId: z.string().min(1),
  inputMode: z.literal("MANUAL"),
  customExperimentName: z.string().min(1),
  experimentContext: z.string().optional(),
  direction: z.string().optional(),
  prerequisite: z.string().optional(),
  lang: z.enum(["zh", "en"]).default("zh"),
});

const schema = z.union([standardSchema, manualSchema]);

export async function POST(req: Request) {
  try {
    const user = await requireUserFromRequest(req);
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", code: "INVALID_PAYLOAD" }, { status: 400 });
    }
    if (isDemoMode()) {
      const llmConfig = await getRuntimeLlmConfigForUser(user.id);
      const resolution =
        parsed.data.inputMode === "MANUAL"
          ? await resolveExperimentInput({
              customExperimentName: parsed.data.customExperimentName,
              experimentContext: parsed.data.experimentContext,
              directionCode: parsed.data.direction,
              lang: parsed.data.lang,
              llmConfig,
            })
          : null;
      return NextResponse.json(
        await demoCheckExperiment({
          labId: parsed.data.labId,
          experimentType:
            parsed.data.inputMode === "MANUAL" ? (resolution?.resolvedExperimentType ?? undefined) : parsed.data.experimentType,
          direction: parsed.data.direction,
          prerequisite: parsed.data.prerequisite,
          resolution,
        }),
      );
    }
    await assertLabAccess(user.id, parsed.data.labId);
    const llmConfig = await getRuntimeLlmConfigForUser(user.id);
    const resolution =
      parsed.data.inputMode === "MANUAL"
        ? await resolveExperimentInput({
            customExperimentName: parsed.data.customExperimentName,
            experimentContext: parsed.data.experimentContext,
            directionCode: parsed.data.direction,
            lang: parsed.data.lang,
            llmConfig,
          })
        : null;
    const experimentCode =
      parsed.data.inputMode === "MANUAL" ? (resolution?.resolvedExperimentType ?? undefined) : parsed.data.experimentType;

    if (!experimentCode) {
      return NextResponse.json({
        status: "BLOCKED",
        confidenceLabel: "LOW",
        minMissing: [],
        recommendedMissing: [],
        warnings: [
          parsed.data.lang === "en"
            ? "Manual experiment name could not be resolved to a formal experiment type yet."
            : "手动输入的实验名称暂未能归一为正式实验类型，请先查看候选建议并确认。",
        ],
        compatibilityIssues: [],
        resolvedExperimentType: resolution?.resolvedExperimentType ?? null,
        resolutionSource: resolution?.resolutionSource ?? "MODEL_SUGGESTION",
        resolutionConfidence: resolution?.resolutionConfidence ?? 0,
        needsConfirmation: true,
        suggestion: resolution?.suggestion ?? null,
      });
    }

    const result = await runExperimentCheck({
      labId: parsed.data.labId,
      userId: user.id,
      experimentCode,
      directionCode: parsed.data.direction,
      prerequisite: parsed.data.prerequisite,
      lang: parsed.data.lang,
    });
    return NextResponse.json({
      ...result,
      resolvedExperimentType: experimentCode,
      resolutionSource: resolution?.resolutionSource ?? "DIRECT",
      resolutionConfidence: resolution?.resolutionConfidence ?? 1,
      needsConfirmation: resolution?.needsConfirmation ?? false,
      suggestion: resolution?.suggestion ?? null,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }
}
