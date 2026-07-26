import { evidenceSourceById } from "@/lib/experiment-techniques/sources";
import {
  experimentTechniqueSchema,
  requirementKindValues,
  type ExperimentTechnique,
} from "@/lib/experiment-techniques/types";

export type PublicationGateResult = {
  publishable: boolean;
  errors: string[];
};

export function validateTechniqueForPublication(
  value: unknown,
): PublicationGateResult {
  const parsed = experimentTechniqueSchema.safeParse(value);
  if (!parsed.success) {
    return {
      publishable: false,
      errors: [`Structure validation failed: ${parsed.error.message}`],
    };
  }
  const technique = parsed.data;
  const errors: string[] = [];
  const sources = technique.evidenceSourceIds
    .map((id) => evidenceSourceById.get(id))
    .filter((source): source is NonNullable<typeof source> => Boolean(source));

  const unknownEvidence = technique.evidenceSourceIds.filter(
    (id) => !evidenceSourceById.has(id),
  );
  if (unknownEvidence.length) {
    errors.push(`Unknown evidence sources: ${unknownEvidence.join(", ")}.`);
  }
  if (technique.ontologyMappings.length === 0) {
    errors.push(
      "At least one manually verified OBI, CHMO or MeSH term mapping is required; source-level links are not a term mapping.",
    );
  }
  if (
    !technique.ontologyMappings.some((mapping) =>
      ["OBI", "CHMO", "MESH"].includes(mapping.scheme),
    )
  ) {
    errors.push("No authoritative terminology mapping from OBI, CHMO or MeSH.");
  }
  if (!sources.some((source) => source.sourceType === "VERSIONED_PROTOCOL")) {
    errors.push("A fixed-version external operational source is required.");
  }
  if (
    !sources.some(
      (source) =>
        source.sourceType === "REPORTING_STANDARD" &&
        ["A1", "A2", "B1", "B2"].includes(source.tier),
    )
  ) {
    errors.push("An applicable standard or quality/reporting source is required.");
  }

  const requirementKinds = new Set(
    technique.requirements.map((requirement) => requirement.kind),
  );
  for (const kind of requirementKindValues) {
    if (!requirementKinds.has(kind)) {
      errors.push(`Resource dimension ${kind} is missing.`);
    }
  }
  if (!technique.requirements.some((item) => item.level === "REQUIRED")) {
    errors.push("At least one required resource must be declared.");
  }

  const claimSourceIds = new Set(technique.claimEvidence.map((claim) => claim.evidenceSourceId));
  for (const claimSourceId of claimSourceIds) {
    if (!technique.evidenceSourceIds.includes(claimSourceId)) {
      errors.push(
        `Claim evidence ${claimSourceId} is not included in the technique evidence graph.`,
      );
    }
  }
  for (const metric of technique.qcMetrics) {
    for (const sourceId of metric.evidenceSourceIds) {
      if (!technique.evidenceSourceIds.includes(sourceId)) {
        errors.push(`QC evidence ${sourceId} is not included in the evidence graph.`);
      }
    }
  }
  for (const sourceId of technique.safety.evidenceSourceIds) {
    if (!technique.evidenceSourceIds.includes(sourceId)) {
      errors.push(`Safety evidence ${sourceId} is not included in the evidence graph.`);
    }
  }

  return { publishable: errors.length === 0, errors };
}

export function isFormallyPublished(technique: ExperimentTechnique) {
  return (
    technique.status === "PUBLISHED" &&
    validateTechniqueForPublication(technique).publishable
  );
}

