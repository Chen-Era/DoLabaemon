import { RuleLevel } from "@prisma/client";
import { normalizeTargetName, type AntibodyRoleValue, type MatcherTypeValue, type RuleLevelValue } from "@/lib/rules/catalog";

type MaybeNull<T> = T | null | undefined;

export type EvaluatableAntibodyMeta = {
  role?: MaybeNull<AntibodyRoleValue>;
  hostSpecies?: MaybeNull<string>;
  targetSpecies?: MaybeNull<string>;
  targetName?: MaybeNull<string>;
};

export type EvaluatablePrimerMeta = {
  targetName?: MaybeNull<string>;
  isReferenceGene?: MaybeNull<boolean>;
};

export type EvaluatableReagent = {
  id?: string;
  name: string;
  catalogNo?: MaybeNull<string>;
  vendor?: MaybeNull<string>;
  subCategory?: MaybeNull<string>;
  note?: MaybeNull<string>;
  experimentTags?: string[];
  antibodyMeta?: MaybeNull<EvaluatableAntibodyMeta>;
  primerMeta?: MaybeNull<EvaluatablePrimerMeta>;
};

export type EvaluatableRule = {
  level: RuleLevelValue | RuleLevel;
  displayNameZh: string;
  displayNameEn: string;
  matcherType: MatcherTypeValue | string;
  matcherValues: string[];
  matcherAntibodyRole?: MaybeNull<AntibodyRoleValue | string>;
  requiredKeywords?: string[];
};

type EvaluatedItem = {
  level: RuleLevel;
  displayName: string;
  isMissing: boolean;
  matchedName?: string;
};

function normalizeSearchableText(reagent: EvaluatableReagent) {
  return [reagent.name, reagent.catalogNo, reagent.vendor, reagent.subCategory, reagent.note]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function matchByName(rule: EvaluatableRule, reagent: EvaluatableReagent) {
  const keywords = [...rule.matcherValues, ...(rule.requiredKeywords ?? [])].map((value) => value.toLowerCase());
  if (keywords.length === 0) return false;
  const searchable = normalizeSearchableText(reagent);
  return keywords.some((keyword) => searchable.includes(keyword));
}

function matchByTag(rule: EvaluatableRule, reagent: EvaluatableReagent) {
  if (!reagent.experimentTags?.length || !rule.matcherValues.length) return false;
  return rule.matcherValues.some((value) => reagent.experimentTags?.includes(value));
}

function matchAntibodyRole(requiredRole: EvaluatableRule["matcherAntibodyRole"], reagent: EvaluatableReagent) {
  if (!requiredRole) return true;
  return reagent.antibodyMeta?.role === requiredRole;
}

function matchByAntibodyTarget(rule: EvaluatableRule, reagent: EvaluatableReagent) {
  if (!reagent.antibodyMeta || !matchAntibodyRole(rule.matcherAntibodyRole, reagent)) return false;
  if (rule.matcherValues.length === 0) return true;
  const normalizedTarget = normalizeTargetName(reagent.antibodyMeta.targetName);
  if (!normalizedTarget) return false;
  return rule.matcherValues.map((value) => normalizeTargetName(value)).includes(normalizedTarget);
}

function matchByPrimerTarget(rule: EvaluatableRule, reagent: EvaluatableReagent) {
  if (!reagent.primerMeta?.targetName) return false;
  if (reagent.primerMeta.isReferenceGene) return false;
  if (rule.matcherValues.length === 0) return true;
  const normalizedTarget = normalizeTargetName(reagent.primerMeta.targetName);
  if (!normalizedTarget) return false;
  return rule.matcherValues.map((value) => normalizeTargetName(value)).includes(normalizedTarget);
}

function matchByReferencePrimer(reagent: EvaluatableReagent) {
  return reagent.primerMeta?.isReferenceGene === true;
}

export function matchRuleToReagent(rule: EvaluatableRule, reagent: EvaluatableReagent) {
  switch (rule.matcherType) {
    case "TAG_ANY":
      return matchByTag(rule, reagent);
    case "NAME_ANY":
      return matchByName(rule, reagent);
    case "ANTIBODY_TARGET_ANY":
      return matchByAntibodyTarget(rule, reagent);
    case "PRIMER_TARGET_ANY":
      return matchByPrimerTarget(rule, reagent);
    case "PRIMER_REFERENCE":
      return matchByReferencePrimer(reagent);
    default:
      return matchByName(rule, reagent);
  }
}

export function evaluateRules(input: {
  rules: EvaluatableRule[];
  reagents: EvaluatableReagent[];
  lang?: "zh" | "en";
}) {
  const minMissing: string[] = [];
  const recommendedMissing: string[] = [];
  const items: EvaluatedItem[] = [];

  for (const rule of input.rules) {
    const matched = input.reagents.find((reagent) => matchRuleToReagent(rule, reagent));
    const displayName = input.lang === "en" ? rule.displayNameEn : rule.displayNameZh;
    const level = rule.level === "RECOMMENDED" ? RuleLevel.RECOMMENDED : RuleLevel.MIN_REQUIRED;
    const isMissing = !matched;

    items.push({
      level,
      displayName,
      isMissing,
      matchedName: matched?.name,
    });

    if (isMissing && level === RuleLevel.MIN_REQUIRED) {
      minMissing.push(displayName);
    }

    if (isMissing && level === RuleLevel.RECOMMENDED) {
      recommendedMissing.push(displayName);
    }
  }

  return {
    status: minMissing.length === 0 ? "PASS" : "BLOCKED",
    minMissing,
    recommendedMissing,
    items,
  };
}
