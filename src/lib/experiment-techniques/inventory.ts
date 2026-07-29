import { demoListReagents } from "@/lib/demo-store";
import { isDemoMode } from "@/lib/demo-mode";
import type { InventoryCapability } from "@/lib/experiment-techniques/check";
import { prisma } from "@/lib/prisma";

export async function listInventoryCapabilities(
  labId: string,
): Promise<InventoryCapability[]> {
  if (isDemoMode()) {
    return demoListReagents(labId).map((reagent) => ({
      id: reagent.id,
      name: reagent.name,
      experimentTags: reagent.experimentTags,
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
    experimentTags: reagent.experimentTags,
    available:
      (reagent.quantity === null || reagent.quantity > 0) &&
      (reagent.expiryDate === null || reagent.expiryDate.getTime() >= now),
  }));
}
