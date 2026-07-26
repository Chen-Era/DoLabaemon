import { createHash } from "node:crypto";

import {
  techniqueCategoryCodes,
  type TechniqueCategoryCode,
} from "@/lib/experiment-techniques/data/blueprint";
import { evidenceSourceById } from "@/lib/experiment-techniques/sources";
import {
  evidenceSourceSchema,
  experimentTechniqueSchema,
  requirementKindValues,
  type EvidenceSource,
  type ExperimentTechnique,
} from "@/lib/experiment-techniques/types";

export const expectedLeafCounts: Record<TechniqueCategoryCode, number> = {
  SAMPLE_MODELS: 25,
  NUCLEIC_ACID_GENETIC_ENGINEERING: 45,
  PROTEIN_IMMUNOASSAYS: 40,
  IMAGING_HISTOLOGY: 35,
  CYTOMETRY_SORTING: 15,
  CELL_FUNCTION: 35,
  MICROBIOLOGY_INFECTION: 25,
  ANALYTICAL_BIOPHYSICS: 30,
  SEQUENCING_OMICS: 30,
  STRUCTURAL_BIOLOGY: 15,
  ANIMAL_IN_VIVO: 25,
  ECOLOGY_FIELD: 15,
};

export type CatalogValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  summary: {
    leafCount: number;
    categoryCounts: Record<TechniqueCategoryCode, number>;
    evidenceSourceCount: number;
  };
};

function normalizeTerm(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/[‐‑‒–—―]/g, "-")
    .replace(/[\s_/()（）·.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function duplicateValues(values: string[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

export function validateTechniqueCatalog(
  techniques: ExperimentTechnique[],
  evidenceSources: EvidenceSource[],
): CatalogValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const sourceById = new Map(evidenceSources.map((source) => [source.id, source]));
  const techniqueCodes = new Set(techniques.map((technique) => technique.code));
  const leafTechniques = techniques.filter((technique) => !technique.isAbstract);
  const categoryCounts = Object.fromEntries(
    techniqueCategoryCodes.map((code) => [code, 0]),
  ) as Record<TechniqueCategoryCode, number>;

  for (const source of evidenceSources) {
    const result = evidenceSourceSchema.safeParse(source);
    if (!result.success) {
      errors.push(`Evidence source ${source.id} is invalid: ${result.error.message}`);
    }
  }

  if (leafTechniques.length !== 335) {
    errors.push(`Expected exactly 335 leaf techniques, received ${leafTechniques.length}.`);
  }

  for (const technique of techniques) {
    const parsed = experimentTechniqueSchema.safeParse(technique);
    if (!parsed.success) {
      errors.push(`${technique.code}: schema validation failed: ${parsed.error.message}`);
      continue;
    }

    const { contentHash, ...withoutHash } = technique;
    const expectedHash = createHash("sha256")
      .update(JSON.stringify(withoutHash))
      .digest("hex");
    if (contentHash !== expectedHash) {
      errors.push(`${technique.code}: content hash does not match its snapshot.`);
    }
    if (technique.parentCode && !techniqueCodes.has(technique.parentCode)) {
      errors.push(`${technique.code}: parent ${technique.parentCode} does not exist.`);
    }
    if (technique.parentCode === technique.code) {
      errors.push(`${technique.code}: technique cannot be its own parent.`);
    }

    if (!technique.isAbstract) {
      categoryCounts[technique.categoryCode] += 1;
    }

    if (!technique.isAbstract) {
      const requirementKinds = new Set(technique.requirements.map((item) => item.kind));
      for (const kind of requirementKindValues) {
        if (!requirementKinds.has(kind)) {
          errors.push(`${technique.code}: resource dimension ${kind} is not declared.`);
        }
      }

      const requiredRequirementIds = technique.requirements
        .filter((item) => item.level === "REQUIRED")
        .map((item) => item.id);
      if (requiredRequirementIds.length === 0) {
        errors.push(`${technique.code}: no REQUIRED resource requirements are declared.`);
      }
      if (duplicateValues(technique.requirements.map((item) => item.id)).length) {
        errors.push(`${technique.code}: duplicate requirement IDs.`);
      }
    }

    const unknownSources = technique.evidenceSourceIds.filter((id) => !sourceById.has(id));
    if (unknownSources.length) {
      errors.push(`${technique.code}: unknown evidence sources ${unknownSources.join(", ")}.`);
    }
    for (const claim of technique.claimEvidence) {
      if (!technique.evidenceSourceIds.includes(claim.evidenceSourceId)) {
        errors.push(
          `${technique.code}: claim ${claim.claimId} cites an unbound source ${claim.evidenceSourceId}.`,
        );
      }
    }
    for (const metric of technique.qcMetrics) {
      for (const sourceId of metric.evidenceSourceIds) {
        if (!technique.evidenceSourceIds.includes(sourceId)) {
          errors.push(
            `${technique.code}: QC ${metric.id} cites an unbound source ${sourceId}.`,
          );
        }
      }
    }
    for (const sourceId of technique.safety.evidenceSourceIds) {
      if (!technique.evidenceSourceIds.includes(sourceId)) {
        errors.push(`${technique.code}: safety cites an unbound source ${sourceId}.`);
      }
    }
    for (const standard of technique.reportingStandards) {
      if (!technique.evidenceSourceIds.includes(standard.standardId)) {
        errors.push(
          `${technique.code}: reporting standard ${standard.standardId} is not bound as evidence.`,
        );
      }
    }

    const citedSources = technique.evidenceSourceIds
      .map((id) => sourceById.get(id))
      .filter((source): source is EvidenceSource => Boolean(source));
    if (
      !citedSources.some(
        (source) =>
          source.sourceType === "ONTOLOGY" ||
          source.sourceType === "CONTROLLED_VOCABULARY",
      )
    ) {
      errors.push(`${technique.code}: no authoritative terminology anchor.`);
    }
    if (!citedSources.some((source) => ["A1", "A2", "B1", "B2"].includes(source.tier))) {
      errors.push(`${technique.code}: no A/B-grade evidence source.`);
    }
    if (!citedSources.some((source) => source.sourceType === "VERSIONED_PROTOCOL")) {
      warnings.push(
        `${technique.code}: no technique-specific fixed-version external SOP is linked yet.`,
      );
    }
    if (
      citedSources.some(
        (source) =>
          source.sourceType === "VERSIONED_PROTOCOL" &&
          ["C1", "C2"].includes(source.tier),
      ) &&
      !citedSources.some((source) => ["B1", "B2"].includes(source.tier))
    ) {
      errors.push(`${technique.code}: a C-grade operational source lacks B-grade method support.`);
    }

    for (const profile of technique.profiles) {
      if (!profile.additionalRequirements.length) {
        errors.push(`${technique.code}/${profile.code}: profile has no additional requirements.`);
      }
    }
  }

  for (const code of techniqueCategoryCodes) {
    if (categoryCounts[code] !== expectedLeafCounts[code]) {
      errors.push(
        `${code}: expected ${expectedLeafCounts[code]} leaves, received ${categoryCounts[code]}.`,
      );
    }
  }

  for (const technique of techniques) {
    const visited = new Set<string>();
    let current: ExperimentTechnique | undefined = technique;
    while (current?.parentCode) {
      if (visited.has(current.parentCode)) {
        errors.push(`${technique.code}: parent relationship contains a cycle.`);
        break;
      }
      visited.add(current.parentCode);
      current = techniques.find((item) => item.code === current?.parentCode);
    }
  }

  for (const duplicate of duplicateValues(techniques.map((item) => item.code))) {
    errors.push(`Duplicate technique code: ${duplicate}.`);
  }
  for (const duplicate of duplicateValues(techniques.map((item) => item.slug))) {
    errors.push(`Duplicate technique slug: ${duplicate}.`);
  }

  const primaryNameOwner = new Map<string, string>();
  for (const technique of techniques) {
    for (const name of [technique.name.zh, technique.name.en]) {
      const normalized = normalizeTerm(name);
      const existing = primaryNameOwner.get(normalized);
      if (existing && existing !== technique.code) {
        errors.push(`Primary-name collision: ${name} is used by ${existing} and ${technique.code}.`);
      } else {
        primaryNameOwner.set(normalized, technique.code);
      }
    }
  }

  const aliasOwner = new Map<string, string>();
  for (const technique of techniques) {
    const ownedTerms = new Set(
      [technique.code, technique.slug, technique.name.zh, technique.name.en].map(
        normalizeTerm,
      ),
    );
    const meaningfulAliases = technique.aliases
      .map(normalizeTerm)
      .filter((alias) => alias.length >= 2);
    if (
      meaningfulAliases.some((alias) => ownedTerms.has(alias)) ||
      duplicateValues(meaningfulAliases).length
    ) {
      warnings.push(`${technique.code}: aliases repeat its code, slug or primary name.`);
    }
    for (const alias of technique.aliases) {
      const normalized = normalizeTerm(alias);
      if (normalized.length < 2) continue;
      const existing = aliasOwner.get(normalized);
      if (existing && existing !== technique.code) {
        errors.push(`Alias collision: ${alias} is used by ${existing} and ${technique.code}.`);
      } else {
        aliasOwner.set(normalized, technique.code);
      }
      const primaryOwner = primaryNameOwner.get(normalized);
      if (primaryOwner && primaryOwner !== technique.code) {
        errors.push(
          `Alias-to-name collision: ${alias} belongs to ${technique.code} but names ${primaryOwner}.`,
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    summary: {
      leafCount: leafTechniques.length,
      categoryCounts,
      evidenceSourceCount: evidenceSources.length,
    },
  };
}

export function assertValidTechniqueCatalog(
  techniques: ExperimentTechnique[],
  evidenceSources: EvidenceSource[],
) {
  const result = validateTechniqueCatalog(techniques, evidenceSources);
  if (!result.valid) {
    throw new Error(`Experiment-technique catalog is invalid:\n${result.errors.join("\n")}`);
  }
  return result;
}

/**
 * Curation-level warnings for a repository technique. Unlike the hard
 * validation errors above, these flag content that may sync as the SYSTEM
 * baseline but must not be treated as a formal publication until curated.
 */
export function curationWarningsForTechnique(
  technique: ExperimentTechnique,
): string[] {
  const warnings: string[] = [];
  const citedSources = technique.evidenceSourceIds
    .map((id) => evidenceSourceById.get(id))
    .filter((source): source is EvidenceSource => Boolean(source));

  if (!citedSources.some((source) => source.sourceType === "VERSIONED_PROTOCOL")) {
    warnings.push("no technique-specific fixed-version external SOP is linked yet");
  }
  if (
    technique.ontologyMappings.length === 0 ||
    !technique.ontologyMappings.some((mapping) =>
      ["OBI", "CHMO", "MESH"].includes(mapping.scheme),
    )
  ) {
    warnings.push("no manually verified OBI/CHMO/MeSH term mapping");
  }
  if (technique.ontologyUnmappedReason) {
    warnings.push("ontology mapping pending manual curation");
  }
  return warnings;
}
