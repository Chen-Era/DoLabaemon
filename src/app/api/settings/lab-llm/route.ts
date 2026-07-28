import { NextResponse } from "next/server";
import { z } from "zod";

import { getLabLlmConfigView, upsertLabLlmConfig, deleteLabLlmConfig } from "@/lib/llm/lab-config";
import { REASONING_EFFORT_LEVELS } from "@/lib/llm/reasoning-effort";
import { assertLabAccess, canManageLabLlmConfig } from "@/lib/permissions";
import { requireUserFromRequest } from "@/lib/session";

const updateSchema = z.object({
  labId: z.string().trim().min(1).max(128),
  openaiApiKey: z.string().max(4096).optional(),
  openaiBaseUrl: z.string().max(2048).optional(),
  openaiModel: z.string().trim().max(256).optional(),
  openaiVisionModel: z.string().trim().max(256).optional(),
  reasoningEffort: z.enum(REASONING_EFFORT_LEVELS).optional(),
  isEnabled: z.boolean().optional(),
});

function jsonError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  if (message === "NO_LAB_ACCESS") return NextResponse.json({ error: "Forbidden", code: "NO_LAB_ACCESS" }, { status: 403 });
  if (message === "LAB_LLM_API_KEY_REQUIRED" || message === "LAB_LLM_MODEL_REQUIRED") {
    return NextResponse.json({ error: "启用实验室公用模型时必须提供 API Key 和文本模型名", code: "LAB_LLM_CONFIG_INCOMPLETE" }, { status: 400 });
  }
  if (message.startsWith("LAB_LLM_CONFIG_ENCRYPTION_KEY")) {
    return NextResponse.json({ error: "服务器未配置实验室模型密钥的加密主密钥", code: "LAB_LLM_ENCRYPTION_UNAVAILABLE" }, { status: 503 });
  }
  return NextResponse.json({ error: "实验室公用模型配置操作失败", code: "LAB_LLM_CONFIG_FAILED" }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    const user = await requireUserFromRequest(request);
    const labId = new URL(request.url).searchParams.get("labId")?.trim();
    if (!labId) return NextResponse.json({ error: "Missing labId", code: "MISSING_LAB_ID" }, { status: 400 });

    const membership = await assertLabAccess(user.id, labId);
    return NextResponse.json({
      labId,
      role: membership.role,
      canManage: canManageLabLlmConfig(membership.role),
      config: await getLabLlmConfigView(labId),
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUserFromRequest(request);
    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid payload", code: "INVALID_PAYLOAD" }, { status: 400 });

    const membership = await assertLabAccess(user.id, parsed.data.labId);
    if (!canManageLabLlmConfig(membership.role)) return NextResponse.json({ error: "Forbidden", code: "FORBIDDEN" }, { status: 403 });

    await upsertLabLlmConfig(parsed.data.labId, parsed.data);
    return NextResponse.json({
      labId: parsed.data.labId,
      role: membership.role,
      canManage: true,
      config: await getLabLlmConfigView(parsed.data.labId),
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireUserFromRequest(request);
    const labId = new URL(request.url).searchParams.get("labId")?.trim();
    if (!labId) return NextResponse.json({ error: "Missing labId", code: "MISSING_LAB_ID" }, { status: 400 });

    const membership = await assertLabAccess(user.id, labId);
    if (!canManageLabLlmConfig(membership.role)) return NextResponse.json({ error: "Forbidden", code: "FORBIDDEN" }, { status: 403 });

    await deleteLabLlmConfig(labId);
    return NextResponse.json({
      labId,
      role: membership.role,
      canManage: true,
      config: await getLabLlmConfigView(labId),
    });
  } catch (error) {
    return jsonError(error);
  }
}
