import { NextResponse } from "next/server";
import { z } from "zod";
import { REASONING_EFFORT_LEVELS } from "@/lib/llm/reasoning-effort";
import { deleteUserLlmConfig, getLlmConfigView, upsertUserLlmConfig } from "@/lib/llm/runtime-config";
import { requireUserFromRequest } from "@/lib/session";

const schema = z.object({
  openaiApiKey: z.string().optional(),
  openaiBaseUrl: z.string().optional(),
  openaiModel: z.string().optional(),
  openaiVisionModel: z.string().optional(),
  searchEnabled: z.boolean().default(true),
  searchProvider: z.string().optional(),
  searchApiKey: z.string().optional(),
  searchBaseUrl: z.string().optional(),
  enabledSkills: z.array(z.string()).default([]),
  enabledMcpServers: z.array(z.string()).default([]),
  selfCheckEnabled: z.boolean().default(true),
  autoLearnEnabled: z.boolean().default(false),
  reasoningEffort: z.enum(REASONING_EFFORT_LEVELS).optional(),
  // Accept submissions from the pre-upgrade settings page without allowing a
  // missing new field to reset the saved preference to "off".
  thinkingEnabled: z.boolean().optional(),
  knowledgeVerifySkipEnabled: z.boolean().default(true),
});

function getErrorDetails(error: unknown) {
  return {
    errorName: error instanceof Error ? error.name : typeof error,
    errorMessage: error instanceof Error ? error.message : String(error),
    errorStack: error instanceof Error ? error.stack : undefined,
  };
}

function classifyConfigError(error: unknown, action: "load" | "save") {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  if (
    (message.includes("unknown argument") || message.includes("unknown field")) &&
    (message.includes("enabledskills") ||
      message.includes("enabledmcpservers") ||
      message.includes("selfcheckenabled") ||
      message.includes("autolearnenabled") ||
      message.includes("thinkingenabled") ||
      message.includes("reasoningeffort") ||
      message.includes("knowledgeverifyskipenabled") ||
      message.includes("openaivisionmodel"))
  ) {
    return {
      code: "PRISMA_CLIENT_OUTDATED",
      error: `${action === "save" ? "保存" : "加载"}失败：Prisma Client 可能未同步最新 schema，请执行 npx prisma generate 后重试。`,
    };
  }

  if (
    (message.includes("column") && message.includes("does not exist")) ||
    message.includes("no such column") ||
    (message.includes("the column") && message.includes("does not exist"))
  ) {
    return {
      code: "DB_SCHEMA_OUTDATED",
      error: `${action === "save" ? "保存" : "加载"}失败：数据库缺少最新配置字段，请执行 Prisma 迁移后重试。`,
    };
  }

  if (message.includes("p1001") || message.includes("can't reach database server") || message.includes("connect") && message.includes("database")) {
    return {
      code: "DATABASE_UNAVAILABLE",
      error: `${action === "save" ? "保存" : "加载"}失败：当前无法连接数据库，请检查 DATABASE_URL、网络或代理设置。`,
    };
  }

  return {
    code: action === "save" ? "SAVE_CONFIG_FAILED" : "LOAD_CONFIG_FAILED",
    error: action === "save" ? "Save config failed" : "Load config failed",
  };
}

export async function GET(req: Request) {
  try {
    const user = await requireUserFromRequest(req);
    return NextResponse.json(await getLlmConfigView(user.id));
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }
    console.error("[settings-llm] load config failed", getErrorDetails(error));
    return NextResponse.json(classifyConfigError(error, "load"), { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUserFromRequest(req);
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", code: "INVALID_PAYLOAD" }, { status: 400 });
    }

    const { thinkingEnabled, reasoningEffort, ...config } = parsed.data;
    await upsertUserLlmConfig(user.id, {
      ...config,
      reasoningEffort: reasoningEffort ?? (thinkingEnabled === undefined ? undefined : thinkingEnabled ? "medium" : "off"),
    });
    return NextResponse.json(await getLlmConfigView(user.id));
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }
    console.error("[settings-llm] save config failed", getErrorDetails(error));
    return NextResponse.json(classifyConfigError(error, "save"), { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await requireUserFromRequest(req);
    await deleteUserLlmConfig(user.id);
    return NextResponse.json(await getLlmConfigView(user.id));
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }
    console.error("[settings-llm] clear config failed", getErrorDetails(error));
    return NextResponse.json(classifyConfigError(error, "save"), { status: 500 });
  }
}
