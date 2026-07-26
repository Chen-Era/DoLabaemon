import { demoListReagents } from "@/lib/demo-store";
import { isDemoMode } from "@/lib/demo-mode";
import type { InventoryCapability } from "@/lib/experiment-techniques/check";
import { prisma } from "@/lib/prisma";

function compact(values: Array<string | null | undefined>) {
  return values.filter((value): value is string => Boolean(value?.trim()));
}

export async function listInventoryCapabilities(
  labId: string,
): Promise<InventoryCapability[]> {
  if (isDemoMode()) {
    return demoListReagents(labId).map((reagent) => ({
      id: reagent.id,
      name: reagent.name,
      capabilityTags: compact([
        ...reagent.experimentTags,
        reagent.category,
        reagent.subCategory,
        reagent.antibodyMeta?.role,
        reagent.antibodyMeta?.targetName,
        reagent.primerMeta?.targetName,
        reagent.primerMeta?.isReferenceGene ? "reference gene primer" : null,
      ]),
      searchableValues: compact([
        reagent.catalogNo,
        reagent.subCategory,
        reagent.antibodyMeta?.targetName,
        reagent.primerMeta?.targetName,
      ]),
      available: true,
    }));
  }

  const reagents = await prisma.reagent.findMany({
    where: { labId },
    include: { antibodyMeta: true, primerMeta: true },
  });
  const now = Date.now();
  return reagents.map((reagent) => ({
    id: reagent.id,
    name: reagent.name,
    capabilityTags: compact([
      ...reagent.experimentTags,
      reagent.category,
      reagent.subCategory,
      reagent.antibodyMeta?.role,
      reagent.antibodyMeta?.targetName,
      reagent.primerMeta?.targetName,
      reagent.primerMeta?.isReferenceGene ? "reference gene primer" : null,
    ]),
    searchableValues: compact([
      reagent.catalogNo,
      reagent.vendor,
      reagent.subCategory,
      reagent.antibodyMeta?.targetName,
      reagent.primerMeta?.targetName,
    ]),
    available:
      (reagent.quantity === null || reagent.quantity > 0) &&
      (reagent.expiryDate === null || reagent.expiryDate.getTime() >= now),
  }));
}

