import { evidenceSourceById } from "@/lib/experiment-techniques/sources";
import type { ExperimentTechnique } from "@/lib/experiment-techniques/types";

export type TechniqueEvidenceBindingInput = {
  evidenceSourceId: string;
  supportedFields: string[];
  claimLocator: string | null;
};

/**
 * Derives the per-source evidence bindings for a technique from the claims,
 * QC metrics, safety profile, reporting standards and ontology anchors that
 * actually cite each source, instead of assuming a fixed field set.
 */
export function buildTechniqueEvidenceBindings(
  technique: ExperimentTechnique,
): TechniqueEvidenceBindingInput[] {
  return technique.evidenceSourceIds.map((evidenceSourceId) => {
    const supportedFields = new Set<string>();
    const claimLocators: string[] = [];

    for (const claim of technique.claimEvidence) {
      if (claim.evidenceSourceId !== evidenceSourceId) continue;
      supportedFields.add(claim.fieldPath);
      claimLocators.push(claim.locator);
    }
    technique.qcMetrics.forEach((metric, index) => {
      if (metric.evidenceSourceIds.includes(evidenceSourceId)) {
        supportedFields.add(`qcMetrics[${index}]`);
      }
    });
    if (technique.safety.evidenceSourceIds.includes(evidenceSourceId)) {
      supportedFields.add("safety");
    }
    technique.reportingStandards.forEach((standard, index) => {
      if (standard.standardId === evidenceSourceId) {
        supportedFields.add(`reportingStandards[${index}]`);
      }
    });
    const source = evidenceSourceById.get(evidenceSourceId);
    if (
      source &&
      (source.sourceType === "ONTOLOGY" ||
        source.sourceType === "CONTROLLED_VOCABULARY")
    ) {
      supportedFields.add("ontologyMappings");
    }

    const fields = [...supportedFields];
    return {
      evidenceSourceId,
      supportedFields: fields.length ? fields : ["general"],
      claimLocator: claimLocators.length ? claimLocators.join(" | ") : null,
    };
  });
}
