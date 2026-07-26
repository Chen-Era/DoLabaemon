import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isDemoMode } from "@/lib/demo-mode";
import { demoSearchLabs } from "@/lib/demo-store";

export const dynamic = "force-dynamic";

// Public lab directory lookup used on the registration screen so newcomers can
// find an existing lab and ask to join it. Only minimal, non-sensitive fields
// are exposed.
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = (searchParams.get("q") ?? "").trim();
    if (query.length < 1) {
      return NextResponse.json({ items: [] });
    }
    if (isDemoMode()) {
      return NextResponse.json({ items: demoSearchLabs(query) });
    }
    const items = await prisma.lab.findMany({
      where: { name: { contains: query, mode: "insensitive" } },
      select: { id: true, name: true, _count: { select: { members: true } } },
      orderBy: { name: "asc" },
      take: 8,
    });
    return NextResponse.json({
      items: items.map((lab) => ({ id: lab.id, name: lab.name, memberCount: lab._count.members })),
    });
  } catch (error) {
    console.error("[register/labs] failed:", error);
    return NextResponse.json({ error: "搜索实验室失败", code: "LAB_SEARCH_FAILED" }, { status: 500 });
  }
}
