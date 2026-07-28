import { NextResponse } from "next/server";
import { z } from "zod";

import {
  LLM_NOT_CONFIGURED_ERROR,
  matchTechniquesWithLlm,
} from "@/lib/experiment-techniques/ai-match";
import { listPublishedTechniques } from "@/lib/experiment-techniques/runtime";
import { getRuntimeLlmConfigForLabMember } from "@/lib/llm/runtime-config";
import { assertLabAccess } from "@/lib/permissions";
import { requireUserFromRequest } from "@/lib/session";

const schema = z.object({
  labId: z.string().trim().min(1),
  query: z.string().trim().min(1).max(500),
  limit: z.number().int().min(1).max(20).default(5),
  lang: z.enum(["zh", "en"]).default("zh"),
});

export async function POST(request: Request) {
  try {
    const user = await requireUserFromRequest(request);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", code: "INVALID_PAYLOAD" },
        { status: 400 },
      );
    }

    await assertLabAccess(user.id, parsed.data.labId);
    const [techniques, llmConfig] = await Promise.all([
      listPublishedTechniques(),
      getRuntimeLlmConfigForLabMember(user.id, parsed.data.labId),
    ]);

    const result = await matchTechniquesWithLlm({
      query: parsed.data.query,
      techniques,
      llmConfig,
      limit: parsed.data.limit,
      lang: parsed.data.lang,
    });

    return NextResponse.json({
      source: "LLM",
      notes: result.notes,
      candidates: result.candidates.map((candidate) => ({
        code: candidate.technique.code,
        slug: candidate.technique.slug,
        name: candidate.technique.name,
        aliases: candidate.technique.aliases,
        categoryCode: candidate.technique.categoryCode,
        riskLevel: candidate.technique.safety.riskLevel,
        confidence: candidate.confidence,
        rationale: candidate.rationale,
      })),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json(
        { error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 },
      );
    }
    if (error instanceof Error && error.message === "NO_LAB_ACCESS") {
      return NextResponse.json(
        { error: "No lab access", code: "NO_LAB_ACCESS" },
        { status: 403 },
      );
    }
    if (error instanceof Error && error.message === LLM_NOT_CONFIGURED_ERROR) {
      return NextResponse.json(
        {
          error: "尚未配置大模型，无法使用 AI 模糊匹配。请在设置页配置 API Key，或改用严格规则解析。",
          code: LLM_NOT_CONFIGURED_ERROR,
        },
        { status: 503 },
      );
    }
    if (error instanceof Error && error.message === "TECHNIQUE_AI_MATCH_TIMEOUT") {
      return NextResponse.json(
        { error: "大模型响应超时，请稍后重试或改用严格规则解析。", code: "AI_MATCH_TIMEOUT" },
        { status: 504 },
      );
    }
    console.error("[experiment-techniques] ai-match failed", error);
    return NextResponse.json(
      { error: "AI 模糊匹配失败，请稍后重试或改用严格规则解析。", code: "AI_MATCH_FAILED" },
      { status: 502 },
    );
  }
}
