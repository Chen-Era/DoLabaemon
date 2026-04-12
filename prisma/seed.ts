import { PrismaClient } from "@prisma/client";
import { experimentTypeCatalog, researchDirectionCatalog, ruleCatalog } from "@/lib/rules/catalog";

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
}

main().finally(async () => prisma.$disconnect());
