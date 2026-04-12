import { prisma } from "@/lib/prisma";
import { evaluateRules } from "@/lib/rules/evaluate";
import { ruleCatalog, type RuleDefinition } from "@/lib/rules/catalog";
import { checkWbAntibodyCompatibility } from "@/lib/rules/wb-antibody-check";

export function selectApplicableRules<T extends { experimentCode: string; directionCode?: string | null }>(
  rules: T[],
  experimentCode: string,
  directionCode?: string,
) {
  return rules.filter((rule) => {
    if (rule.experimentCode !== experimentCode) return false;
    if (!rule.directionCode) return true;
    return rule.directionCode === directionCode;
  });
}

function toCatalogRule(rule: {
  level: string;
  displayNameZh: string;
  displayNameEn: string;
  matcherType: string;
  matcherValues: string[];
  matcherAntibodyRole?: string | null;
}): RuleDefinition {
  return {
    experimentCode: "",
    level: rule.level as RuleDefinition["level"],
    displayNameZh: rule.displayNameZh,
    displayNameEn: rule.displayNameEn,
    matcherType: rule.matcherType as RuleDefinition["matcherType"],
    matcherValues: rule.matcherValues,
    matcherAntibodyRole: (rule.matcherAntibodyRole ?? undefined) as RuleDefinition["matcherAntibodyRole"],
  };
}

export async function runExperimentCheck(input: {
  labId: string;
  userId: string;
  experimentCode: string;
  directionCode?: string;
  prerequisite?: string;
  lang?: "zh" | "en";
}) {
  const rules = await prisma.experimentRule.findMany({
    where: {
      experimentType: { code: input.experimentCode },
    },
    include: { researchDirection: true },
  });

  const dbRules = rules
    .filter((r) => {
      if (!r.researchDirection) return true;
      return r.researchDirection.code === input.directionCode;
    })
    .map((rule) =>
      toCatalogRule({
        level: rule.level,
        displayNameZh: rule.displayNameZh,
        displayNameEn: rule.displayNameEn,
        matcherType: rule.matcherType,
        matcherValues: rule.matcherValues,
        matcherAntibodyRole: rule.matcherAntibodyRole,
      }),
    );
  const catalogRules = selectApplicableRules(ruleCatalog, input.experimentCode, input.directionCode);
  const effectiveRules = dbRules.length > 0 ? dbRules : catalogRules;

  const reagents = await prisma.reagent.findMany({
    where: { labId: input.labId },
    include: { antibodyMeta: true, primerMeta: true },
  });

  const evaluation = evaluateRules({
    rules: effectiveRules,
    reagents,
    lang: input.lang,
  });

  const warnings: string[] = [];
  let confidenceLabel = "HIGH";
  if (!input.prerequisite) {
    confidenceLabel = "MEDIUM";
    warnings.push(input.lang === "en" ? "Prerequisite not selected." : "未选择前置实验，结论仅供参考。");
  }

  if (dbRules.length === 0 && catalogRules.length > 0) {
    warnings.push(
      input.lang === "en"
        ? "Using bundled rule catalog because database rules are not synchronized yet."
        : "当前数据库规则尚未同步，已回退使用项目内置规则目录进行判定。",
    );
  }

  if (effectiveRules.length === 0) {
    warnings.push(input.lang === "en" ? "No applicable rules were found for this selection." : "当前组合暂无适用规则，结论可能不完整。");
  }

  const compatibilityIssues =
    input.experimentCode === "WB"
      ? checkWbAntibodyCompatibility(reagents.flatMap((r) => (r.antibodyMeta ? [r.antibodyMeta] : [])))
      : [];

  const run = await prisma.experimentCheckRun.create({
    data: {
      labId: input.labId,
      userId: input.userId,
      experimentCode: input.experimentCode,
      directionCode: input.directionCode,
      prerequisite: input.prerequisite,
      confidenceLabel,
      status: evaluation.status,
      warnings,
      compatibilityIssues,
      items: { create: evaluation.items },
    },
  });

  return {
    runId: run.id,
    status: evaluation.status,
    confidenceLabel,
    minMissing: evaluation.minMissing,
    recommendedMissing: evaluation.recommendedMissing,
    warnings,
    compatibilityIssues,
  };
}
