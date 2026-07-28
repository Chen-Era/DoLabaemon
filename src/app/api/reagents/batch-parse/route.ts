import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isDemoMode } from "@/lib/demo-mode";
import { demoParseReagent } from "@/lib/demo-store";
import { toSafeJsonValue } from "@/lib/json/safe-json";
import { assertLabAccess } from "@/lib/permissions";
import { requireUserFromRequest } from "@/lib/session";
import { getRuntimeLlmConfigForLabMember } from "@/lib/llm/runtime-config";
import { extractBatchRows } from "@/lib/reagent-ingest/extract-batch-rows";
import { parseReagentInput } from "@/lib/reagent-ingest/parse-reagent";
import { mapWithConcurrency } from "@/lib/async/map-with-concurrency";

const schema = z.object({
  labId: z.string().min(1),
  rawText: z.string().min(1),
  lang: z.enum(["zh", "en"]).default("zh"),
});

const BATCH_PARSE_CONCURRENCY = 4;

function mergeNotes(parts: Array<string | null | undefined>) {
  const cleaned = parts.map((part) => part?.trim()).filter(Boolean);
  return cleaned.length ? cleaned.join(" | ") : undefined;
}

function buildMissingCatalogError(row: Awaited<ReturnType<typeof extractBatchRows>>[number]) {
  const searchStatus = row.supplementation?.searchStatus;
  if (searchStatus === "request_failed") {
    return "缺少货号，且联网补齐失败，请检查搜索配置或网络后重试";
  }
  if (searchStatus === "no_results") {
    return "缺少货号，联网未补到可用货号，请手工补充货号";
  }
  if (searchStatus === "evidence_inconclusive") {
    return "缺少货号，已检索到线索但无法可靠补齐，请手工补充货号";
  }
  return "缺少货号，暂不能入库";
}

function buildParseFailureError(row: Awaited<ReturnType<typeof extractBatchRows>>[number]) {
  if (row.supplementation?.searchStatus === "request_failed") {
    return "该条试剂解析失败，且联网补齐阶段也发生异常，请检查搜索配置、模型配置或网络";
  }
  return "该条试剂解析失败，请检查名称或货号格式";
}

export async function POST(req: Request) {
  try {
    const user = await requireUserFromRequest(req);
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", code: "INVALID_PAYLOAD" }, { status: 400 });
    }

    const membership = await assertLabAccess(user.id, parsed.data.labId);
    const llmConfig = await getRuntimeLlmConfigForLabMember(user.id, parsed.data.labId);

    const extractedRows = await extractBatchRows(parsed.data.rawText, parsed.data.lang, {
      allowLlm: !isDemoMode(),
      llmConfig,
    });

    if (!extractedRows.length) {
      return NextResponse.json({ error: "No reagent rows extracted", code: "EMPTY_BATCH" }, { status: 400 });
    }

    const items = await mapWithConcurrency(extractedRows, BATCH_PARSE_CONCURRENCY, async (row, index) => {
        const note = mergeNotes([row.note, row.antibodyCompatibilityText, row.vendor ? `Vendor: ${row.vendor}` : null]);
        const payload = {
          name: row.name,
          vendor: row.vendor ?? null,
          catalogNo: row.catalogNo ?? null,
          note: row.note ?? null,
          antibodyCompatibilityText: row.antibodyCompatibilityText ?? null,
          sourceText: row.sourceText,
        };

        if (!row.catalogNo) {
          return {
            rowId: `row-${index + 1}`,
            rawInput: payload,
            error: buildMissingCatalogError(row),
          };
        }

        if (isDemoMode()) {
          const out = demoParseReagent({
            labId: parsed.data.labId,
            userId: user.id,
            name: row.name,
            catalogNo: row.catalogNo,
            note,
          });

          return {
            rowId: `row-${index + 1}`,
            draftId: out.draftId,
            rawInput: payload,
            parsed: out.parsed,
            parseSource: "fallback" as const,
            verificationStatus: "unverified" as const,
            verificationMethod: "none" as const,
            verificationReason: "external_search_unconfigured" as const,
          };
        }

        try {
          const result = await parseReagentInput({
            name: row.name,
            catalogNo: row.catalogNo,
            vendor: row.vendor,
            note,
            lang: parsed.data.lang,
          }, {
            llmConfig,
            flowContext: {
              flow: "reagent-parse",
              labId: parsed.data.labId,
              userId: user.id,
              role: membership.role,
              llmConfig,
            },
          });

          const draft = await prisma.reagentParseDraft.create({
            data: {
              labId: parsed.data.labId,
              userId: user.id,
              rawInput: toSafeJsonValue(payload) as Prisma.InputJsonValue,
              parsedOutput: toSafeJsonValue(result.parsed) as Prisma.InputJsonValue,
              confidence: result.parsed.confidence,
              warnings: result.parsed.warnings,
            },
          });

          return {
            rowId: `row-${index + 1}`,
            draftId: draft.id,
            rawInput: payload,
            parsed: result.parsed,
            parseSource: result.parseSource,
            verificationStatus: result.verificationStatus,
            verificationMethod: result.verificationMethod,
            verificationReason: result.verificationReason,
            ai: result.ai,
          };
        } catch (error) {
          console.error("[reagent-batch-parse] row failed", {
            rowId: `row-${index + 1}`,
            errorName: error instanceof Error ? error.name : typeof error,
            errorMessage: error instanceof Error ? error.message : String(error),
          });
          return {
            rowId: `row-${index + 1}`,
            rawInput: payload,
            error: buildParseFailureError(row),
          };
        }
      });

    return NextResponse.json({ items });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "NO_LAB_ACCESS") {
      return NextResponse.json({ error: "No lab access", code: "NO_LAB_ACCESS" }, { status: 403 });
    }
    console.error("[reagent-batch-parse] request failed:", error);
    return NextResponse.json({ error: "Batch parse request failed", code: "BATCH_PARSE_REQUEST_FAILED" }, { status: 500 });
  }
}
