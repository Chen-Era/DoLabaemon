import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveTechniqueCandidates } from "@/lib/experiment-techniques/search";
import { listPublishedTechniques } from "@/lib/experiment-techniques/runtime";
import { requireUserFromRequest } from "@/lib/session";

const schema = z.object({
  query: z.string().trim().min(1).max(500),
  limit: z.number().int().min(1).max(20).default(8),
});

export async function POST(request: Request) {
  try {
    await requireUserFromRequest(request);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", code: "INVALID_PAYLOAD" },
        { status: 400 },
      );
    }
    const result = resolveTechniqueCandidates(
      await listPublishedTechniques(),
      parsed.data.query,
      parsed.data.limit,
    );
    return NextResponse.json({
      ...result,
      candidates: result.candidates.map((candidate) => ({
        code: candidate.technique.code,
        slug: candidate.technique.slug,
        name: candidate.technique.name,
        aliases: candidate.technique.aliases,
        categoryCode: candidate.technique.categoryCode,
        status: candidate.technique.status,
        isAbstract: candidate.technique.isAbstract,
        score: candidate.score,
        exact: candidate.exact,
        evidence: candidate.evidence,
      })),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json(
        { error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 },
      );
    }
    console.error("[experiment-techniques] resolve failed", error);
    return NextResponse.json(
      { error: "Resolution failed", code: "RESOLUTION_FAILED" },
      { status: 500 },
    );
  }
}
