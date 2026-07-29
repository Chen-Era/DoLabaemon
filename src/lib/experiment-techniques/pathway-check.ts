import { evaluateRules } from "@/lib/rules/evaluate";
import {
  researchDirectionCatalog,
  ruleCatalog,
  type RuleDefinition,
} from "@/lib/rules/catalog";
import {
  getPhenotypePathwayDomain,
  phenotypePathwayDomains,
  type PhenotypePathwayCategory,
} from "@/lib/experiment-techniques/phenotype-domains";

import type { InventoryCapability } from "@/lib/experiment-techniques/check";

type LocalizedLabel = { zh: string; en: string };

export type PathwayCheckContext = {
  code: string;
  category: PhenotypePathwayCategory;
  name: LocalizedLabel;
  description: LocalizedLabel | null;
  specializedReagents: LocalizedLabel | null;
  targetRequirements: LocalizedLabel | null;
  targetPanel: {
    mechanistic: readonly string[];
    readout: readonly string[];
    controls: readonly string[];
  } | null;
  ruleCount: number;
  requiredRuleCount: number;
};

// The legacy rule catalog predates the pathway ontology and used a few broader
// immune direction codes. Keep stored rules stable while presenting the
// research-facing topic names in the experiment-check UI and API.
const pathwayToRuleDirectionCode: Record<string, string> = {
  INFLAMMASOME: "INNATE_INFLAMMATION_INFLAMMASOME",
  T_CELL_ACTIVATION_EXHAUSTION: "T_CELL_IMMUNITY",
  CHECKPOINT_IMMUNITY: "IMMUNE_CHECKPOINT_SUPPRESSION",
};

const ruleDirectionToPathwayCode = new Map(
  Object.entries(pathwayToRuleDirectionCode).map(([pathwayCode, ruleCode]) => [
    ruleCode,
    pathwayCode,
  ]),
);

// A multicolour or intracellular flow panel is a specialised implementation of
// a FLOW check. This compatibility set prevents immune topics from vanishing
// merely because their ontology records a more specific flow modality.
const compatibleTechniqueCodes: Record<string, readonly string[]> = {
  FLOW: ["FLOW", "MULTICOLOR_IMMUNOPHENOTYPING", "INTRACELLULAR_CYTOKINE_FLOW", "PHOSPHO_FLOW"],
  MULTICOLOR_IMMUNOPHENOTYPING: ["FLOW", "MULTICOLOR_IMMUNOPHENOTYPING"],
  INTRACELLULAR_CYTOKINE_FLOW: ["FLOW", "INTRACELLULAR_CYTOKINE_FLOW"],
  PHOSPHO_FLOW: ["FLOW", "PHOSPHO_FLOW"],
};

// A few topic-method links are intentionally broader than the headline method
// list in the knowledge card: FLOW can quantify caspase-1/pyroptosis probes for
// an inflammasome study, even when the card foregrounds WB/ELISA/IF readouts.
const additionalPathwayTechniqueCodes: Record<string, readonly string[]> = {
  INFLAMMASOME: ["FLOW"],
};

function canonicalPathwayCode(code: string) {
  return ruleDirectionToPathwayCode.get(code) ?? code;
}

function ruleDirectionCode(code: string) {
  return pathwayToRuleDirectionCode[code] ?? code;
}

function compatibleTechniqueCodeSet(techniqueCode: string) {
  return new Set(compatibleTechniqueCodes[techniqueCode] ?? [techniqueCode]);
}

function pathwaySupportsTechnique(
  pathwayCode: string,
  techniqueCode: string,
  pathwayTechniqueCodes: readonly string[],
) {
  const compatibleCodes = compatibleTechniqueCodeSet(techniqueCode);
  return (
    pathwayTechniqueCodes.some((code) => compatibleCodes.has(code)) ||
    (additionalPathwayTechniqueCodes[pathwayCode] ?? []).some((code) =>
      compatibleCodes.has(code),
    )
  );
}

export type PathwayRuleCheckItem = {
  level: "MIN_REQUIRED" | "RECOMMENDED";
  displayName: string;
  isMissing: boolean;
  matchedName?: string;
};

export type PathwayRuleCheckResult = {
  items: PathwayRuleCheckItem[];
  missingRequired: string[];
  missingRecommended: string[];
};

function rulesForPathway(techniqueCode: string, directionCode: string): RuleDefinition[] {
  const compatibleCodes = compatibleTechniqueCodeSet(techniqueCode);
  const ruleDirection = ruleDirectionCode(canonicalPathwayCode(directionCode));
  return ruleCatalog.filter(
    (rule) =>
      compatibleCodes.has(rule.experimentCode) && rule.directionCode === ruleDirection,
  );
}

/**
 * A direction can only be offered to a technique when the curated pathway
 * ontology links the two and the bundled rule catalog has concrete checks for
 * that pairing. This prevents a pathway selector from producing an empty,
 * falsely passing resource check.
 */
export function getPathwayCheckContext(
  techniqueCode: string,
  directionCode: string,
): PathwayCheckContext | null {
  const pathwayCode = canonicalPathwayCode(directionCode);
  const direction = researchDirectionCatalog.find(
    (item) => item.code === ruleDirectionCode(pathwayCode),
  );
  const pathway = getPhenotypePathwayDomain(pathwayCode);
  const rules = rulesForPathway(techniqueCode, pathwayCode);
  if (
    !direction ||
    !pathway ||
    !pathwaySupportsTechnique(pathway.code, techniqueCode, pathway.techniqueCodes) ||
    !rules.length
  ) {
    return null;
  }

  return {
    code: pathway.code,
    category: pathway.category,
    name: pathway.name,
    description: pathway.description,
    specializedReagents: pathway.specializedReagents,
    targetRequirements: pathway.targetRequirements,
    targetPanel: pathway.targetPanel,
    ruleCount: rules.length,
    requiredRuleCount: rules.filter((rule) => rule.level === "MIN_REQUIRED").length,
  };
}

export function listPathwayCheckContexts(techniqueCode: string): PathwayCheckContext[] {
  return phenotypePathwayDomains
    .map((pathway) => getPathwayCheckContext(techniqueCode, pathway.code))
    .filter((context): context is PathwayCheckContext => Boolean(context));
}

export function evaluatePathwayCheckRules(
  techniqueCode: string,
  context: PathwayCheckContext,
  inventory: InventoryCapability[],
): PathwayRuleCheckResult {
  const rules = rulesForPathway(techniqueCode, context.code);
  const evaluation = evaluateRules({
    rules,
    reagents: inventory.filter((item) => item.available !== false),
    lang: "zh",
  });

  return {
    items: evaluation.items.map((item) => ({
      level: item.level === "MIN_REQUIRED" ? "MIN_REQUIRED" : "RECOMMENDED",
      displayName: item.displayName,
      isMissing: item.isMissing,
      matchedName: item.matchedName,
    })),
    missingRequired: evaluation.minMissing,
    missingRecommended: evaluation.recommendedMissing,
  };
}
