import { ReagentCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertLabAccess } from "@/lib/permissions";
import { isDemoMode } from "@/lib/demo-mode";

const MAX_RESULTS = 10;
const MAX_TARGETS = 10;

type InventoryRow = {
  id: string;
  name: string;
  catalogNo: string;
  vendor: string | null;
  category: ReagentCategory;
  quantity: number | null;
  unit: string | null;
  expiryDate: Date | null;
  antibodyMeta: { role: "PRIMARY" | "SECONDARY"; targetName: string | null } | null;
};

export type InventoryCandidate = {
  reagentId: string;
  name: string;
  catalogNo: string;
  vendor: string | null;
  category: ReagentCategory;
  antibody: { role: "PRIMARY" | "SECONDARY"; targetName: string | null } | null;
  availability: { state: "available" | "out_of_stock" | "expired" | "unknown"; quantity: number | null; unit: string | null; expiryDate: string | null };
  match: { field: "targetName" | "name" | "catalogNo"; normalizedQuery: string; score: number };
};

export type ReagentResolution = {
  target: string;
  status: "resolved" | "ambiguous" | "not_found";
  selected: InventoryCandidate | null;
  candidates: InventoryCandidate[];
  requiresUserConfirmation: boolean;
  warnings: string[];
};

export class McpInventoryError extends Error {
  constructor(public readonly code: "MCP_DEMO_UNSUPPORTED" | "MCP_SCOPE_REQUIRED" | "MCP_INVALID_TARGETS") {
    super(code);
  }
}

function normalize(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[βΒ]/g, "beta")
    .replace(/[αΑ]/g, "alpha")
    .replace(/抗体|antibody|anti[-\s]?/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function aliasesForTarget(target: string) {
  const normalized = normalize(target);
  const aliases = new Set([normalized]);
  if (["betaactin", "actb"].includes(normalized)) {
    aliases.add("betaactin");
    aliases.add("actb");
  }
  return aliases;
}

function queryVariants(query: string) {
  const variants = new Set([query.trim()]);
  const aliases = aliasesForTarget(query);
  if (aliases.has("betaactin") || aliases.has("actb")) {
    variants.add("β-actin");
    variants.add("beta-actin");
    variants.add("ACTB");
  }
  return [...variants].filter(Boolean);
}

function availabilityOf(reagent: InventoryRow): InventoryCandidate["availability"] {
  const expiryDate = reagent.expiryDate?.toISOString() ?? null;
  if (reagent.expiryDate && reagent.expiryDate.getTime() < Date.now()) {
    return { state: "expired", quantity: reagent.quantity, unit: reagent.unit, expiryDate };
  }
  if (reagent.quantity === null) {
    return { state: "unknown", quantity: null, unit: reagent.unit, expiryDate };
  }
  return {
    state: reagent.quantity > 0 ? "available" : "out_of_stock",
    quantity: reagent.quantity,
    unit: reagent.unit,
    expiryDate,
  };
}

function scoreMatch(reagent: InventoryRow, target: string): InventoryCandidate["match"] | null {
  const aliases = aliasesForTarget(target);
  const fields: Array<[InventoryCandidate["match"]["field"], string | null, number]> = [
    ["targetName", reagent.antibodyMeta?.targetName ?? null, 100],
    ["name", reagent.name, 75],
    ["catalogNo", reagent.catalogNo, 50],
  ];
  for (const [field, value, exactScore] of fields) {
    const normalized = normalize(value);
    if (!normalized) continue;
    if ([...aliases].some((alias) => alias === normalized)) {
      return { field, normalizedQuery: normalize(target), score: exactScore };
    }
    if ([...aliases].some((alias) => alias.length >= 3 && normalized.includes(alias))) {
      return { field, normalizedQuery: normalize(target), score: exactScore - 20 };
    }
  }
  return null;
}

export function rankInventoryMatches(rows: InventoryRow[], target: string, limit = MAX_RESULTS): InventoryCandidate[] {
  return rows
    .map((reagent) => {
      const match = scoreMatch(reagent, target);
      if (!match) return null;
      return {
        reagentId: reagent.id,
        name: reagent.name,
        catalogNo: reagent.catalogNo,
        vendor: reagent.vendor,
        category: reagent.category,
        antibody: reagent.antibodyMeta,
        availability: availabilityOf(reagent),
        match,
      } satisfies InventoryCandidate;
    })
    .filter((candidate): candidate is InventoryCandidate => candidate !== null)
    .sort((left, right) => right.match.score - left.match.score || left.name.localeCompare(right.name, "zh-CN"))
    .slice(0, Math.min(Math.max(1, limit), MAX_RESULTS));
}

function assertMcpAvailable() {
  if (isDemoMode()) {
    throw new McpInventoryError("MCP_DEMO_UNSUPPORTED");
  }
}

export async function listAuthorizedLabs(userId: string) {
  assertMcpAvailable();
  const memberships = await prisma.labMember.findMany({
    where: { userId },
    include: { lab: true },
    orderBy: { lab: { name: "asc" } },
  });
  return memberships.map((membership) => ({ id: membership.lab.id, name: membership.lab.name, role: membership.role }));
}

async function findRows(input: { userId: string; labId: string; query: string; category?: ReagentCategory; limit?: number }) {
  assertMcpAvailable();
  await assertLabAccess(input.userId, input.labId);
  const query = input.query.trim();
  const variants = queryVariants(query);
  const rows = await prisma.reagent.findMany({
    where: {
      labId: input.labId,
      ...(input.category ? { category: input.category } : {}),
      ...(query
        ? {
            OR: [
              ...variants.map((value) => ({ name: { contains: value, mode: "insensitive" as const } })),
              ...variants.map((value) => ({ catalogNo: { contains: value, mode: "insensitive" as const } })),
              ...variants.map((value) => ({ antibodyMeta: { is: { targetName: { contains: value, mode: "insensitive" as const } } } })),
            ],
          }
        : {}),
    },
    include: { antibodyMeta: true },
    orderBy: { uploadedAt: "desc" },
    take: Math.min(Math.max(1, input.limit ?? MAX_RESULTS), MAX_RESULTS),
  });
  return rows;
}

export async function searchLabReagents(input: { userId: string; labId: string; query: string; category?: ReagentCategory; limit?: number }) {
  const rows = await findRows(input);
  return rankInventoryMatches(rows, input.query, input.limit);
}

export async function resolveWesternBlotAntibodies(input: { userId: string; labId: string; targets: string[] }) {
  if (!input.targets.length || input.targets.length > MAX_TARGETS || input.targets.some((target) => !target.trim())) {
    throw new McpInventoryError("MCP_INVALID_TARGETS");
  }
  assertMcpAvailable();
  await assertLabAccess(input.userId, input.labId);
  const resolutions: ReagentResolution[] = [];
  for (const target of input.targets) {
    const rows = await findRows({
      userId: input.userId,
      labId: input.labId,
      query: target,
      category: "ANTIBODY",
      limit: MAX_RESULTS,
    });
    const candidates = rankInventoryMatches(rows, target, MAX_RESULTS);
    const primaryCandidates = candidates.filter((candidate) => candidate.antibody?.role === "PRIMARY");
    const exactPrimary = primaryCandidates.filter((candidate) => candidate.match.field === "targetName" && candidate.match.score === 100);
    const warnings = candidates.some((candidate) => candidate.antibody?.role === "SECONDARY")
      ? ["Secondary-antibody matches were excluded from automatic resolution."]
      : [];
    if (exactPrimary.length === 1) {
      resolutions.push({
        target,
        status: "resolved",
        selected: exactPrimary[0],
        candidates: primaryCandidates,
        requiresUserConfirmation: false,
        warnings,
      });
    } else if (primaryCandidates.length > 0) {
      resolutions.push({
        target,
        status: "ambiguous",
        selected: null,
        candidates: primaryCandidates,
        requiresUserConfirmation: true,
        warnings: [...warnings, "More than one or no exact primary-antibody match exists. Select the actually used item."],
      });
    } else {
      resolutions.push({
        target,
        status: "not_found",
        selected: null,
        candidates: [],
        requiresUserConfirmation: true,
        warnings: [...warnings, "No matching primary antibody was found in this laboratory inventory."],
      });
    }
  }
  return {
    source: "Dorlabaemon inventory catalog",
    retrievedAt: new Date().toISOString(),
    notProofOfActualUse: true,
    labId: input.labId,
    resolutions,
  };
}
