import { Prisma, PrismaClient, ReagentCategory } from "@prisma/client";
import { isDemoMode } from "@/lib/demo-mode";
import { demoListReagents } from "@/lib/demo-store";

export const REAGENT_LIST_PAGE_SIZE = 50;

export const reagentListSortKeys = ["name", "catalogNo", "category", "vendor", "uploadedAt"] as const;
export type ReagentListSortKey = (typeof reagentListSortKeys)[number];
export type ReagentListSortDirection = "asc" | "desc";

export type ReagentListOptions = {
  page: number;
  query: string;
  tag: string | null;
  sort: ReagentListSortKey;
  direction: ReagentListSortDirection;
};

type ReagentListItem = {
  id: string;
  name: string;
  catalogNo: string;
  category: string;
  vendor?: string | null;
  uploadedByName?: string | null;
  uploadedAt?: string | Date | null;
  experimentTags?: string[];
  antibodyMeta?: { targetName?: string | null } | null;
  primerMeta?: { targetName?: string | null } | null;
};

export function normalizeReagentListOptions(input: Partial<ReagentListOptions> = {}): ReagentListOptions {
  return {
    page: Number.isInteger(input.page) && (input.page ?? 0) > 0 ? input.page! : 1,
    query: input.query?.trim() ?? "",
    tag: input.tag?.trim() || null,
    sort: reagentListSortKeys.includes(input.sort as ReagentListSortKey) ? (input.sort as ReagentListSortKey) : "uploadedAt",
    direction: input.direction === "asc" ? "asc" : "desc",
  };
}

function matchesDemoItem(item: ReagentListItem, options: ReagentListOptions) {
  if (options.tag && !item.experimentTags?.includes(options.tag)) return false;
  if (!options.query) return true;

  const query = options.query.toLowerCase();
  return [
    item.name,
    item.catalogNo,
    item.category,
    item.vendor,
    item.uploadedByName,
    ...(item.experimentTags ?? []),
    item.antibodyMeta?.targetName,
    item.primerMeta?.targetName,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(query);
}

function sortItems<T extends ReagentListItem>(items: T[], options: ReagentListOptions) {
  const multiplier = options.direction === "asc" ? 1 : -1;
  return [...items].sort((left, right) => {
    const leftValue = String(left[options.sort] ?? "");
    const rightValue = String(right[options.sort] ?? "");
    return leftValue.localeCompare(rightValue, "zh-CN", { numeric: true, sensitivity: "base" }) * multiplier;
  });
}

function collectTags(items: Array<{ experimentTags: string[] }>) {
  return [...new Set(items.flatMap((item) => item.experimentTags))].sort((left, right) => left.localeCompare(right));
}

export function listDemoReagents(labId: string, input?: Partial<ReagentListOptions>) {
  const options = normalizeReagentListOptions(input);
  const allItems = demoListReagents(labId);
  const matchingItems = sortItems(allItems.filter((item) => matchesDemoItem(item, options)), options);
  const total = matchingItems.length;
  const pageCount = Math.max(1, Math.ceil(total / REAGENT_LIST_PAGE_SIZE));
  const page = Math.min(options.page, pageCount);
  const start = (page - 1) * REAGENT_LIST_PAGE_SIZE;

  return {
    items: matchingItems.slice(start, start + REAGENT_LIST_PAGE_SIZE),
    total,
    page,
    pageSize: REAGENT_LIST_PAGE_SIZE,
    availableTags: collectTags(allItems),
  };
}

function buildWhere(labId: string, options: ReagentListOptions): Prisma.ReagentWhereInput {
  const conditions: Prisma.ReagentWhereInput[] = [{ labId }];

  if (options.tag) {
    conditions.push({ experimentTags: { has: options.tag } });
  }

  if (options.query) {
    const queryConditions: Prisma.ReagentWhereInput[] = [
      { name: { contains: options.query, mode: "insensitive" } },
      { catalogNo: { contains: options.query, mode: "insensitive" } },
      { vendor: { contains: options.query, mode: "insensitive" } },
      { uploadedByName: { contains: options.query, mode: "insensitive" } },
      { experimentTags: { has: options.query } },
      { antibodyMeta: { is: { targetName: { contains: options.query, mode: "insensitive" } } } },
      { primerMeta: { is: { targetName: { contains: options.query, mode: "insensitive" } } } },
    ];
    const category = options.query.toUpperCase();
    if (Object.values(ReagentCategory).includes(category as ReagentCategory)) {
      queryConditions.push({ category: category as ReagentCategory });
    }
    conditions.push({
      OR: queryConditions,
    });
  }

  return { AND: conditions };
}

function buildOrderBy(options: ReagentListOptions): Prisma.ReagentOrderByWithRelationInput {
  return { [options.sort]: options.direction };
}

export async function listDatabaseReagents(
  prisma: PrismaClient,
  labId: string,
  input?: Partial<ReagentListOptions>,
) {
  const options = normalizeReagentListOptions(input);
  const where = buildWhere(labId, options);
  const [total, availableTagRows] = await Promise.all([
    prisma.reagent.count({ where }),
    prisma.reagent.findMany({ where: { labId }, select: { experimentTags: true } }),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / REAGENT_LIST_PAGE_SIZE));
  const page = Math.min(options.page, pageCount);
  const items = await prisma.reagent.findMany({
    where,
    include: { antibodyMeta: true, primerMeta: true },
    orderBy: buildOrderBy(options),
    skip: (page - 1) * REAGENT_LIST_PAGE_SIZE,
    take: REAGENT_LIST_PAGE_SIZE,
  });

  return {
    items,
    total,
    page,
    pageSize: REAGENT_LIST_PAGE_SIZE,
    availableTags: collectTags(availableTagRows),
  };
}

export async function listReagents(
  prisma: PrismaClient,
  labId: string,
  input?: Partial<ReagentListOptions>,
) {
  if (isDemoMode()) {
    return listDemoReagents(labId, input);
  }
  return listDatabaseReagents(prisma, labId, input);
}
