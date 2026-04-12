import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertLabAccess } from "@/lib/permissions";
import { requireUserFromRequest } from "@/lib/session";
import { isDemoMode } from "@/lib/demo-mode";
import { demoParseReagent } from "@/lib/demo-store";
import { parseReagentInput } from "@/lib/reagent-ingest/parse-reagent";

const schema = z.object({
  labId: z.string().min(1),
  name: z.string().min(1),
  catalogNo: z.string().min(1),
  note: z.string().optional(),
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
      const out = demoParseReagent({
        labId: parsed.data.labId,
        userId: user.id,
        name: parsed.data.name,
        catalogNo: parsed.data.catalogNo,
        note: parsed.data.note,
      });
      return NextResponse.json(
        {
          ...out,
          parseSource: "fallback" as const,
          verificationStatus: "unverified" as const,
          verificationMethod: "none" as const,
          verificationReason: "external_search_unconfigured" as const,
        },
      );
    }
    await assertLabAccess(user.id, parsed.data.labId);
    const { parsed: structured, parseSource, verificationStatus, verificationMethod, verificationReason } = await parseReagentInput({
      name: parsed.data.name,
      catalogNo: parsed.data.catalogNo,
      note: parsed.data.note,
      lang: parsed.data.lang,
    });

    const draft = await prisma.reagentParseDraft.create({
      data: {
        labId: parsed.data.labId,
        userId: user.id,
        rawInput: parsed.data,
        parsedOutput: structured,
        confidence: structured.confidence,
        warnings: structured.warnings,
      },
    });
    return NextResponse.json({ draftId: draft.id, parsed: structured, parseSource, verificationStatus, verificationMethod, verificationReason });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }
    console.error("[reagent-parse] request failed:", error);
    return NextResponse.json({ error: "Parse request failed", code: "PARSE_REQUEST_FAILED" }, { status: 500 });
  }
}
