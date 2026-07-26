import { NextResponse } from "next/server";

import { techniqueCategoryLabels } from "@/lib/experiment-techniques/catalog";
import { getPublishedTechnique } from "@/lib/experiment-techniques/runtime";
import { evidenceSourceById } from "@/lib/experiment-techniques/sources";
import { requireUserFromRequest } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  try {
    await requireUserFromRequest(request);
    const { code } = await context.params;
    const technique = await getPublishedTechnique(decodeURIComponent(code));
    if (!technique) {
      return NextResponse.json(
        { error: "Technique not found", code: "TECHNIQUE_NOT_FOUND" },
        { status: 404 },
      );
    }
    const sources = technique.evidenceSourceIds
      .map((id) => evidenceSourceById.get(id))
      .filter((source): source is NonNullable<typeof source> => Boolean(source));
    const related = (await getRelatedTechniques(technique.code, technique.categoryCode))
      .map((item) => ({
        code: item.code,
        slug: item.slug,
        name: item.name,
        subcategoryCode: item.subcategoryCode,
      }));

    return NextResponse.json({
      technique,
      category: techniqueCategoryLabels[technique.categoryCode],
      sources,
      related,
      publicationGate: {
        hasFixedVersionSop: sources.some(
          (source) => source.sourceType === "VERSIONED_PROTOCOL",
        ),
        hasTerminologyAnchor: sources.some(
          (source) =>
            source.sourceType === "ONTOLOGY" ||
            source.sourceType === "CONTROLLED_VOCABULARY",
        ),
        hasQualityEvidence: sources.some((source) =>
          ["A1", "A2", "B1", "B2"].includes(source.tier),
        ),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json(
        { error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 },
      );
    }
    console.error("[experiment-techniques] detail failed", error);
    return NextResponse.json(
      { error: "Technique detail unavailable", code: "TECHNIQUE_DETAIL_UNAVAILABLE" },
      { status: 500 },
    );
  }
}

async function getRelatedTechniques(code: string, categoryCode: string) {
  const { listPublishedTechniques } = await import(
    "@/lib/experiment-techniques/runtime"
  );
  return (await listPublishedTechniques())
    .filter(
      (technique) =>
        technique.code !== code && technique.categoryCode === categoryCode,
    )
    .slice(0, 8);
}
