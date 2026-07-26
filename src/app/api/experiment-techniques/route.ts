import { NextResponse } from "next/server";
import { z } from "zod";

import { techniqueCategoryLabels } from "@/lib/experiment-techniques/catalog";
import { createTechniqueSearchIndex } from "@/lib/experiment-techniques/search";
import { evidenceSourceById } from "@/lib/experiment-techniques/sources";
import { listPublishedTechniques } from "@/lib/experiment-techniques/runtime";
import { requireUserFromRequest } from "@/lib/session";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  q: z.string().trim().default(""),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
  category: z.string().trim().optional(),
  sample: z.string().trim().optional(),
  readout: z.string().trim().optional(),
  risk: z.enum(["LOW", "MODERATE", "HIGH", "RESTRICTED"]).optional(),
  evidenceTier: z.enum(["A1", "A2", "B1", "B2", "C1", "C2", "D"]).optional(),
  status: z.enum(["DRAFT", "IN_REVIEW", "PUBLISHED", "DEPRECATED"]).optional(),
});

export async function GET(request: Request) {
  try {
    await requireUserFromRequest(request);
    const searchParams = Object.fromEntries(new URL(request.url).searchParams);
    const parsed = querySchema.safeParse(searchParams);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid filters", code: "INVALID_FILTERS", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const techniques = await listPublishedTechniques();
    const tiersByTechnique = new Map(
      techniques.map((technique) => [
        technique.code,
        new Set(
          technique.evidenceSourceIds
            .map((id) => evidenceSourceById.get(id)?.tier)
            .filter((tier): tier is NonNullable<typeof tier> => Boolean(tier)),
        ),
      ]),
    );
    const matches = createTechniqueSearchIndex(techniques)
      .search(
        parsed.data.q,
        {
          category: parsed.data.category,
          sample: parsed.data.sample,
          readout: parsed.data.readout,
          risk: parsed.data.risk,
          evidenceTier: parsed.data.evidenceTier,
        },
        tiersByTechnique,
      )
      .filter(
        (match) =>
          !parsed.data.status || match.technique.status === parsed.data.status,
      );
    const start = (parsed.data.page - 1) * parsed.data.pageSize;
    const items = matches
      .slice(start, start + parsed.data.pageSize)
      .map(({ technique, score, exact }) => ({
        code: technique.code,
        slug: technique.slug,
        revision: technique.revision,
        status: technique.status,
        source: technique.source,
        isAbstract: technique.isAbstract,
        name: technique.name,
        aliases: technique.aliases,
        categoryCode: technique.categoryCode,
        category: techniqueCategoryLabels[technique.categoryCode],
        subcategoryCode: technique.subcategoryCode,
        sampleTypes: technique.sampleTypes,
        readoutModes: technique.readoutModes,
        throughput: technique.throughput,
        destructive: technique.destructive,
        riskLevel: technique.safety.riskLevel,
        evidenceTiers: [...(tiersByTechnique.get(technique.code) ?? [])],
        profileCodes: technique.profiles.map((profile) => profile.code),
        score,
        exact,
      }));

    return NextResponse.json({
      items,
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
      total: matches.length,
      pageCount: Math.ceil(matches.length / parsed.data.pageSize),
      categories: Object.entries(techniqueCategoryLabels).map(([code, label]) => ({
        code,
        ...label,
      })),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json(
        { error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 },
      );
    }
    console.error("[experiment-techniques] list failed", error);
    return NextResponse.json(
      { error: "Technique catalog unavailable", code: "TECHNIQUE_CATALOG_UNAVAILABLE" },
      { status: 500 },
    );
  }
}
