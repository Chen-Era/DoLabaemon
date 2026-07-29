import type {
  ExperimentTechnique as DbExperimentTechnique,
  ExperimentTechniqueProfile as DbExperimentTechniqueProfile,
  TechniqueRequirement as DbTechniqueRequirement,
} from "@prisma/client";

import {
  repositoryTechniqueCatalog,
} from "@/lib/experiment-techniques/catalog";
import { demoListTechniqueOverrides } from "@/lib/demo-store";
import {
  experimentTechniqueSchema,
  type ExperimentTechnique,
  type LocalizedLabel,
  type TechniqueRequirement,
} from "@/lib/experiment-techniques/types";
import { resolveTechniqueReagentCapability } from "@/lib/experiment-techniques/reagent-capabilities";
import { isDemoMode } from "@/lib/demo-mode";
import { prisma } from "@/lib/prisma";
import { isReagentCapabilityTag } from "@/lib/rules/catalog";

type DbTechniqueWithRelations = DbExperimentTechnique & {
  requirements: DbTechniqueRequirement[];
  profiles: Array<
    DbExperimentTechniqueProfile & {
      additionalRequirements: DbTechniqueRequirement[];
    }
  >;
};

function localized(value: unknown): LocalizedLabel {
  const candidate = value as Partial<LocalizedLabel> | null;
  return {
    zh: typeof candidate?.zh === "string" ? candidate.zh : "",
    en: typeof candidate?.en === "string" ? candidate.en : "",
  };
}

function requirementFromDb(requirement: DbTechniqueRequirement): TechniqueRequirement {
  const hasOnlyCanonicalTags = requirement.capabilityTags.every(isReagentCapabilityTag);
  const legacyCapability = hasOnlyCanonicalTags
    ? null
    : requirement.capabilityTags.length === 1
      ? resolveTechniqueReagentCapability(requirement.capabilityTags[0])
      : {
          verificationMode: "MANUAL_CONFIRMATION" as const,
          capabilityTags: [],
          matcherValues: requirement.capabilityTags,
        };
  return {
    id: requirement.id,
    kind: requirement.kind,
    level: requirement.level,
    verificationMode: legacyCapability?.verificationMode ?? requirement.verificationMode,
    label: { zh: requirement.labelZh, en: requirement.labelEn },
    capabilityTags: legacyCapability?.capabilityTags ?? requirement.capabilityTags.filter(isReagentCapabilityTag),
    matcherValues: legacyCapability?.matcherValues.length
      ? legacyCapability.matcherValues
      : requirement.matcherValues,
    condition: requirement.condition ? localized(requirement.condition) : undefined,
  };
}

function summarizeIssues(error: { issues: Array<{ path: PropertyKey[]; message: string }> }) {
  return error.issues
    .slice(0, 5)
    .map((issue) => `${issue.path.map(String).join(".") || "(root)"}: ${issue.message}`)
    .join("; ");
}

function bestEffortCode(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function overlayEntryFromDb(row: DbTechniqueWithRelations): TechniqueOverlayEntry {
  if (!row.active || row.status === "DEPRECATED") {
    return { kind: "shadow", code: row.code };
  }
  const candidate = {
    id: row.id,
    code: row.code,
    slug: row.slug,
    revision: row.revision,
    status: row.status,
    source: row.source,
    contentHash: row.contentHash,
    isAbstract: row.isAbstract,
    parentCode: row.parentCode,
    name: { zh: row.nameZh, en: row.nameEn },
    aliases: row.aliases,
    categoryCode: row.categoryCode,
    subcategoryCode: row.subcategoryCode,
    principle: { zh: row.principleZh, en: row.principleEn },
    scope: { zh: row.scopeZh, en: row.scopeEn },
    sampleTypes: row.sampleTypes,
    inputTypes: row.inputTypes,
    outputTypes: row.outputTypes,
    readoutModes: row.readoutModes,
    throughput: row.throughput,
    destructive: row.destructive,
    workflowStages: row.workflowStages,
    keyParameters: row.keyParameters,
    requirements: row.requirements
      .filter((requirement) => requirement.profileId === null)
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map(requirementFromDb),
    profiles: row.profiles.map((profile) => ({
      code: profile.code,
      name: localized(profile.name),
      description: localized(profile.description),
      additionalRequirements: profile.additionalRequirements
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .map(requirementFromDb),
    })),
    qcMetrics: row.qcMetrics,
    limitations: row.limitations,
    troubleshooting: row.troubleshooting,
    safety: row.safety,
    evidenceSourceIds: row.evidenceSourceIds,
    claimEvidence: row.claimEvidence,
    ontologyMappings: row.ontologyMappings,
    ontologyUnmappedReason: row.ontologyUnmappedReason
      ? localized(row.ontologyUnmappedReason)
      : null,
    reportingStandards: row.reportingStandards,
    resolutionExamples: row.resolutionExamples,
    reviewedAt: row.reviewedAt.toISOString(),
    nextReviewDue: row.nextReviewDue.toISOString(),
  };
  const parsed = experimentTechniqueSchema.safeParse(candidate);
  if (parsed.success) {
    return { kind: "technique", technique: parsed.data };
  }
  return {
    kind: "invalid",
    code: bestEffortCode(candidate.code),
    issues: summarizeIssues(parsed.error),
  };
}

function overlayEntryFromDemoOverride(override: unknown): TechniqueOverlayEntry {
  const code = bestEffortCode((override as { code?: unknown })?.code);
  const status = (override as { status?: unknown })?.status;
  if (status === "DEPRECATED") {
    return { kind: "shadow", code: code ?? "UNKNOWN" };
  }
  const parsed = experimentTechniqueSchema.safeParse(override);
  if (parsed.success) {
    return { kind: "technique", technique: parsed.data };
  }
  return { kind: "invalid", code, issues: summarizeIssues(parsed.error) };
}

async function listDatabaseTechniqueOverlay(): Promise<TechniqueOverlayEntry[]> {
  if (isDemoMode()) {
    return demoListTechniqueOverrides().map(overlayEntryFromDemoOverride);
  }
  try {
    const rows = await prisma.experimentTechnique.findMany({
      include: {
        requirements: true,
        profiles: { include: { additionalRequirements: true } },
      },
      orderBy: { code: "asc" },
    });
    return rows.map(overlayEntryFromDb);
  } catch (error) {
    // This keeps the repository baseline usable before a deployment applies the
    // additive migration. Structural failures still surface as UNSUPPORTED in checks.
    console.warn(
      "[experiment-techniques] Failed to load database technique overlay; using repository baseline only.",
      error,
    );
    return [];
  }
}

export type TechniqueOverlayEntry =
  | { kind: "technique"; technique: ExperimentTechnique }
  | { kind: "shadow"; code: string }
  | { kind: "invalid"; code: string | null; issues: string };

export function mergeTechniqueCatalogsWithReport(
  baseline: ExperimentTechnique[],
  overlay: TechniqueOverlayEntry[],
): { techniques: ExperimentTechnique[]; warnings: string[]; shadowedCodes: string[] } {
  const merged = new Map(baseline.map((technique) => [technique.code, technique]));
  const warnings: string[] = [];
  const shadowedCodes: string[] = [];
  for (const entry of overlay) {
    if (entry.kind === "shadow") {
      merged.delete(entry.code);
      shadowedCodes.push(entry.code);
      continue;
    }
    if (entry.kind === "invalid") {
      warnings.push(
        `Technique overlay entry ${entry.code ?? "(unknown code)"} failed validation and was skipped: ${entry.issues}`,
      );
      continue;
    }
    const databaseTechnique = entry.technique;
    const repositoryTechnique = merged.get(databaseTechnique.code);
    if (!repositoryTechnique) {
      if (databaseTechnique.status === "PUBLISHED") {
        merged.set(databaseTechnique.code, databaseTechnique);
      }
      continue;
    }
    const overlayWins =
      databaseTechnique.revision > repositoryTechnique.revision ||
      (databaseTechnique.revision === repositoryTechnique.revision &&
        databaseTechnique.source === "CURATED");
    if (overlayWins) {
      merged.set(databaseTechnique.code, databaseTechnique);
    }
  }
  const techniques = [...merged.values()].sort((left, right) =>
    left.code.localeCompare(right.code, "en"),
  );
  return { techniques, warnings, shadowedCodes };
}

export function mergeTechniqueCatalogs(
  baseline: ExperimentTechnique[],
  databaseTechniques: ExperimentTechnique[],
) {
  const overlay: TechniqueOverlayEntry[] = databaseTechniques.map((technique) =>
    technique.status === "DEPRECATED"
      ? { kind: "shadow", code: technique.code }
      : { kind: "technique", technique },
  );
  return mergeTechniqueCatalogsWithReport(baseline, overlay).techniques;
}

export async function listPublishedTechniques() {
  const overlay = await listDatabaseTechniqueOverlay();
  const { techniques, warnings } = mergeTechniqueCatalogsWithReport(
    repositoryTechniqueCatalog,
    overlay,
  );
  for (const warning of warnings) {
    console.warn(`[experiment-techniques] ${warning}`);
  }
  return techniques;
}

export async function getPublishedTechnique(codeOrSlug: string) {
  const normalized = codeOrSlug.trim().toLocaleLowerCase("en-US");
  const techniques = await listPublishedTechniques();
  return (
    techniques.find(
      (technique) =>
        technique.code.toLocaleLowerCase("en-US") === normalized ||
        technique.slug.toLocaleLowerCase("en-US") === normalized,
    ) ?? null
  );
}
