import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertLabAccess } from "@/lib/permissions";
import { requireUserFromRequest } from "@/lib/session";
import { isDemoMode } from "@/lib/demo-mode";
import { demoParseReagent } from "@/lib/demo-store";
import { getRuntimeLlmConfigForUser } from "@/lib/llm/runtime-config";
import { toSafeJsonValue } from "@/lib/json/safe-json";
import { parseReagentInput } from "@/lib/reagent-ingest/parse-reagent";

const schema = z.object({
  labId: z.string().min(1),
  name: z.string().min(1),
  catalogNo: z.string().min(1),
  note: z.string().optional(),
  lang: z.enum(["zh", "en"]).default("zh"),
});

type RouteStage = "auth" | "labAccess" | "loadConfig" | "parse" | "saveDraft";
type RouteDiagnostics = {
  stage: RouteStage | "request";
  failedStage?: RouteStage | "request";
  timingsMs: Partial<Record<RouteStage | "total", number>>;
};

type ClassifiedRouteError = {
  status: number;
  code: string;
  error: string;
  detail?: string;
};

function extractPrismaErrorDetail(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.length <= 240 ? message : `${message.slice(0, 240)}...`;
}

async function timeRouteStep<T>(
  diagnostics: RouteDiagnostics,
  stage: RouteStage,
  run: () => Promise<T>,
): Promise<T> {
  diagnostics.stage = stage;
  const startedAt = Date.now();
  try {
    return await run();
  } finally {
    diagnostics.timingsMs[stage] = Date.now() - startedAt;
  }
}

function classifyParseRouteError(error: unknown, stage: RouteDiagnostics["stage"]): ClassifiedRouteError {
  const message = error instanceof Error ? error.message : String(error);
  const lowered = message.toLowerCase();

  if (message === "UNAUTHORIZED") {
    return { status: 401, code: "UNAUTHORIZED", error: "Unauthorized" };
  }
  if (message === "NO_LAB_ACCESS") {
    return { status: 403, code: "NO_LAB_ACCESS", error: "No lab access" };
  }
  if (message.includes("OPENAI_API_KEY missing")) {
    return { status: 500, code: "LLM_CONFIG_MISSING", error: "模型配置缺失：未提供 API Key" };
  }
  if (
    (lowered.includes("unknown argument") || lowered.includes("unknown field"))
    && (lowered.includes("parsedoutput") || lowered.includes("rawinput") || lowered.includes("warnings") || lowered.includes("reagentparsedraft"))
  ) {
    return { status: 500, code: "PRISMA_CLIENT_OUTDATED", error: "Prisma Client 可能未同步最新 schema，请执行 npx prisma generate 后重试" };
  }
  if (
    lowered.includes("does not exist")
    || lowered.includes("no such column")
    || lowered.includes("no such table")
    || (lowered.includes("relation") && lowered.includes("does not exist"))
  ) {
    return { status: 500, code: "DB_SCHEMA_OUTDATED", error: stage === "saveDraft" ? "保存草稿失败：数据库缺少最新表或字段，请执行 Prisma 迁移后重试" : "数据库 schema 未同步，请执行 Prisma 迁移后重试" };
  }
  if (lowered.includes("p1001") || (lowered.includes("database") && lowered.includes("connect"))) {
    return { status: 500, code: "DATABASE_UNAVAILABLE", error: "数据库当前不可用，请检查连接或代理设置" };
  }
  if (
    lowered.includes("invalid value for argument")
    || lowered.includes("json")
    || lowered.includes("serialization")
    || lowered.includes("cannot serialize")
    || lowered.includes("can not use")
  ) {
    return {
      status: 500,
      code: "DRAFT_JSON_INVALID",
      error: "保存草稿失败：解析结果中含有数据库无法接收的 JSON 值，已尝试清洗但仍未写入",
      detail: extractPrismaErrorDetail(error),
    };
  }
  if (stage === "saveDraft") {
    return { status: 500, code: "DRAFT_SAVE_FAILED", error: "解析已完成，但保存草稿失败", detail: extractPrismaErrorDetail(error) };
  }
  return { status: 500, code: "PARSE_REQUEST_FAILED", error: "Parse request failed" };
}

export async function POST(req: Request) {
  const routeDiagnostics: RouteDiagnostics = { stage: "request", timingsMs: {} };
  const requestStartedAt = Date.now();
  let parseDiagnostics: Awaited<ReturnType<typeof parseReagentInput>>["diagnostics"] | undefined;
  let parsedResult:
    | {
        structured: Awaited<ReturnType<typeof parseReagentInput>>["parsed"];
        parseSource: Awaited<ReturnType<typeof parseReagentInput>>["parseSource"];
        verificationStatus: Awaited<ReturnType<typeof parseReagentInput>>["verificationStatus"];
        verificationMethod: Awaited<ReturnType<typeof parseReagentInput>>["verificationMethod"];
        verificationReason: Awaited<ReturnType<typeof parseReagentInput>>["verificationReason"];
        ai: Awaited<ReturnType<typeof parseReagentInput>>["ai"];
      }
    | undefined;
  try {
    const user = await timeRouteStep(routeDiagnostics, "auth", () => requireUserFromRequest(req));
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", code: "INVALID_PAYLOAD" }, { status: 400 });
    }
    if (isDemoMode()) {
      const llmConfig = await timeRouteStep(routeDiagnostics, "loadConfig", () => getRuntimeLlmConfigForUser(user.id));
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
          ai: {
            enabledSkills: llmConfig.enabledSkills,
            enabledMcpServers: llmConfig.enabledMcpServers,
            selfCheck: { ok: false, score: 0, warnings: ["DEMO_MODE 下未执行运行时自检。"] },
            canAutoLearn: false,
          },
          parseSource: "fallback" as const,
          verificationStatus: "unverified" as const,
          verificationMethod: "none" as const,
          verificationReason: "external_search_unconfigured" as const,
          diagnostics: {
            route: {
              ...routeDiagnostics,
              failedStage: undefined,
              timingsMs: {
                ...routeDiagnostics.timingsMs,
                total: Date.now() - requestStartedAt,
              },
            },
          },
        },
      );
    }
    const membership = await timeRouteStep(routeDiagnostics, "labAccess", () => assertLabAccess(user.id, parsed.data.labId));
    const llmConfig = await timeRouteStep(routeDiagnostics, "loadConfig", () => getRuntimeLlmConfigForUser(user.id));
    const { parsed: structured, parseSource, verificationStatus, verificationMethod, verificationReason, ai, diagnostics } = await timeRouteStep(
      routeDiagnostics,
      "parse",
      () =>
        parseReagentInput(
          {
            name: parsed.data.name,
            catalogNo: parsed.data.catalogNo,
            note: parsed.data.note,
            lang: parsed.data.lang,
          },
          {
            llmConfig,
            flowContext: {
              flow: "reagent-parse",
              labId: parsed.data.labId,
              userId: user.id,
              role: membership.role,
              llmConfig,
            },
          },
        ),
    );
    parseDiagnostics = diagnostics;
    parsedResult = { structured, parseSource, verificationStatus, verificationMethod, verificationReason, ai };

    try {
      const safeRawInput = toSafeJsonValue(parsed.data) as Prisma.InputJsonValue;
      const safeParsedOutput = toSafeJsonValue(structured) as Prisma.InputJsonValue;
      const draft = await timeRouteStep(routeDiagnostics, "saveDraft", () => prisma.reagentParseDraft.create({
        data: {
          labId: parsed.data.labId,
          userId: user.id,
          rawInput: safeRawInput,
          parsedOutput: safeParsedOutput,
          confidence: structured.confidence,
          warnings: structured.warnings,
        },
      }));
      return NextResponse.json({
        draftId: draft.id,
        parsed: structured,
        parseSource,
        verificationStatus,
        verificationMethod,
        verificationReason,
        ai,
        diagnostics: {
          parse: parseDiagnostics,
          route: {
            ...routeDiagnostics,
            failedStage: undefined,
            timingsMs: {
              ...routeDiagnostics.timingsMs,
              total: Date.now() - requestStartedAt,
            },
          },
        },
      });
    } catch (error) {
      const classified = classifyParseRouteError(error, "saveDraft");
      routeDiagnostics.failedStage = "saveDraft";
      console.error("[reagent-parse] draft save failed after successful parse", {
        code: classified.code,
        errorName: error instanceof Error ? error.name : typeof error,
        errorMessage: error instanceof Error ? error.message : String(error),
        routeTimingsMs: {
          ...routeDiagnostics.timingsMs,
          total: Date.now() - requestStartedAt,
        },
        parseDiagnostics,
      });
      return NextResponse.json({
        draftId: null,
        draftSaveFailed: true,
        warning: classified.error,
        code: classified.code,
        detail: classified.detail,
        parsed: structured,
        parseSource,
        verificationStatus,
        verificationMethod,
        verificationReason,
        ai,
        diagnostics: {
          parse: parseDiagnostics,
          route: {
            ...routeDiagnostics,
            failedStage: routeDiagnostics.failedStage,
            timingsMs: {
              ...routeDiagnostics.timingsMs,
              total: Date.now() - requestStartedAt,
            },
          },
        },
      });
    }
  } catch (error) {
    routeDiagnostics.failedStage = routeDiagnostics.stage;
    const classified = classifyParseRouteError(error, routeDiagnostics.stage);
    console.error("[reagent-parse] request failed", {
      stage: routeDiagnostics.stage,
      code: classified.code,
      errorName: error instanceof Error ? error.name : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
      routeTimingsMs: {
        ...routeDiagnostics.timingsMs,
        total: Date.now() - requestStartedAt,
      },
      parseDiagnostics,
      parsedResultAvailable: Boolean(parsedResult),
    });
    return NextResponse.json({
      error: classified.error,
      code: classified.code,
      detail: classified.detail,
      stage: routeDiagnostics.stage,
      diagnostics: {
        parse: parseDiagnostics,
        route: {
          ...routeDiagnostics,
          failedStage: routeDiagnostics.failedStage,
          timingsMs: {
            ...routeDiagnostics.timingsMs,
            total: Date.now() - requestStartedAt,
          },
        },
      },
    }, { status: classified.status });
  }
}
