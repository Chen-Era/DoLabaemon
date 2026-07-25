import { PrismaClient } from "@prisma/client";
import { experimentTypeCatalog, researchDirectionCatalog, ruleCatalog } from "@/lib/rules/catalog";
import reagentKnowledgeCatalog from "@/lib/reagent-knowledge/catalog.json";
import experimentKnowledgeCatalog from "@/lib/experiment-knowledge/catalog.json";
import type { ExperimentKnowledgeCatalog } from "@/lib/experiment-knowledge/types";
import type { ReagentKnowledgeCatalog } from "@/lib/reagent-knowledge/types";

const prisma = new PrismaClient();

async function upsertType(code: string, zh: string, en: string) {
  return prisma.experimentType.upsert({
    where: { code },
    update: { nameZh: zh, nameEn: en },
    create: { code, nameZh: zh, nameEn: en },
  });
}

async function upsertDirection(code: string, zh: string, en: string) {
  return prisma.researchDirection.upsert({
    where: { code },
    update: { nameZh: zh, nameEn: en },
    create: { code, nameZh: zh, nameEn: en },
  });
}

async function createRule(input: (typeof ruleCatalog)[number]) {
  const et = await prisma.experimentType.findUniqueOrThrow({ where: { code: input.experimentCode } });
  const rd = input.directionCode
    ? await prisma.researchDirection.findUniqueOrThrow({ where: { code: input.directionCode } })
    : null;

  await prisma.experimentRule.create({
    data: {
      experimentTypeId: et.id,
      researchDirectionId: rd?.id,
      level: input.level,
      displayNameZh: input.displayNameZh,
      displayNameEn: input.displayNameEn,
      requiredKeywords: input.requiredKeywords ?? [],
      matcherType: input.matcherType,
      matcherValues: input.matcherValues,
      matcherAntibodyRole: input.matcherAntibodyRole,
    },
  });
}

async function upsertReagentKnowledgeEntry(input: ReagentKnowledgeCatalog[number]) {
  await prisma.reagentKnowledgeEntry.upsert({
    where: { id: input.id },
    update: {
      canonicalName: input.canonicalName,
      aliases: input.aliases,
      category: input.category,
      subCategory: input.subCategory,
      experimentTags: input.experimentTags,
      namePatterns: input.namePatterns,
      requiredKeywords: input.requiredKeywords,
      excludedKeywords: input.excludedKeywords,
      vendorHints: input.vendorHints,
      evidenceType: input.evidenceType,
      confidenceHint: input.confidenceHint,
      notes: input.notes,
      source: "SYSTEM",
    },
    create: {
      ...input,
      source: "SYSTEM",
    },
  });
}

async function upsertExperimentKnowledgeEntry(input: ExperimentKnowledgeCatalog[number]) {
  await prisma.experimentKnowledgeEntry.upsert({
    where: { id: input.id },
    update: {
      canonicalName: input.canonicalName,
      aliases: input.aliases,
      normalizedCode: input.normalizedCode,
      descriptionZh: input.descriptionZh,
      descriptionEn: input.descriptionEn,
      supportedDirections: input.supportedDirections,
      workflowStages: input.workflowStages,
      requiredReagentTemplates: input.requiredReagentTemplates,
      recommendedReagentTemplates: input.recommendedReagentTemplates,
      evidenceKeywords: input.evidenceKeywords,
      excludedKeywords: input.excludedKeywords,
      relatedExperimentTags: input.relatedExperimentTags,
      source: input.source,
    },
    create: {
      ...input,
      workflowStages: input.workflowStages,
      requiredReagentTemplates: input.requiredReagentTemplates,
      recommendedReagentTemplates: input.recommendedReagentTemplates,
    },
  });
}

async function main() {
  for (const type of experimentTypeCatalog) {
    await upsertType(type.code, type.nameZh, type.nameEn);
  }

  for (const direction of researchDirectionCatalog) {
    await upsertDirection(direction.code, direction.nameZh, direction.nameEn);
  }

  await prisma.experimentRule.deleteMany();

  for (const rule of ruleCatalog) {
    await createRule(rule);
  }

  for (const entry of reagentKnowledgeCatalog as ReagentKnowledgeCatalog) {
    await upsertReagentKnowledgeEntry(entry);
  }

  for (const entry of experimentKnowledgeCatalog as ExperimentKnowledgeCatalog) {
    await upsertExperimentKnowledgeEntry(entry);
  }
}

main().finally(async () => prisma.$disconnect());
