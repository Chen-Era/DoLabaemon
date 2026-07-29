import { evaluateRules } from "@/lib/rules/evaluate";
import {
  researchDirectionCatalog,
  ruleCatalog,
  type RuleDefinition,
} from "@/lib/rules/catalog";
import { getPhenotypePathwayDomain } from "@/lib/experiment-techniques/phenotype-domains";

import type { InventoryCapability } from "@/lib/experiment-techniques/check";

type LocalizedLabel = { zh: string; en: string };

export type PathwayCheckContext = {
  code: string;
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
  return ruleCatalog.filter(
    (rule) =>
      rule.experimentCode === techniqueCode && rule.directionCode === directionCode,
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
  const direction = researchDirectionCatalog.find((item) => item.code === directionCode);
  const pathway = getPhenotypePathwayDomain(directionCode);
  const rules = rulesForPathway(techniqueCode, directionCode);
  if (!direction || !pathway || !pathway.techniqueCodes.includes(techniqueCode) || !rules.length) {
    return null;
  }

  return {
    code: direction.code,
    name: { zh: direction.nameZh, en: direction.nameEn },
    description: pathway.description,
    specializedReagents: pathway.specializedReagents,
    targetRequirements: pathway.targetRequirements,
    targetPanel: pathway.targetPanel,
    ruleCount: rules.length,
    requiredRuleCount: rules.filter((rule) => rule.level === "MIN_REQUIRED").length,
  };
}

export function listPathwayCheckContexts(techniqueCode: string): PathwayCheckContext[] {
  return researchDirectionCatalog
    .map((direction) => getPathwayCheckContext(techniqueCode, direction.code))
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
