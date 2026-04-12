import { prisma } from "@/lib/prisma";
import type { ConfirmDraftItem } from "@/lib/reagent-ingest/types";

export type ConfirmReagentResult =
  | {
      action: "created";
      reagentId: string;
    }
  | {
      action: "incremented";
      reagentId: string;
      beforeQuantity: number;
      afterQuantity: number;
    };

export function normalizeExistingQuantity(quantity: number | null | undefined) {
  return quantity ?? 1;
}

export function buildIncrementResult(reagentId: string, quantity: number | null | undefined): ConfirmReagentResult {
  const beforeQuantity = normalizeExistingQuantity(quantity);
  return {
    action: "incremented",
    reagentId,
    beforeQuantity,
    afterQuantity: beforeQuantity + 1,
  };
}

export function summarizeBatchConfirmResults(
  results: Array<
    | { ok: true; result: ConfirmReagentResult }
    | { ok: false; error: string; draftId?: string }
  >,
) {
  return results.reduce(
    (acc, item) => {
      if (!item.ok) {
        acc.failedCount += 1;
        return acc;
      }
      if (item.result.action === "created") {
        acc.createdCount += 1;
      } else {
        acc.incrementedCount += 1;
      }
      return acc;
    },
    { createdCount: 0, incrementedCount: 0, failedCount: 0 },
  );
}

function createAntibodyMeta(data: ConfirmDraftItem["editedPayload"]["antibodyMeta"]) {
  return data?.role
    ? {
        create: {
          role: data.role,
          hostSpecies: data.hostSpecies,
          targetSpecies: data.targetSpecies,
          targetName: data.targetName,
        },
      }
    : undefined;
}

function createPrimerMeta(data: ConfirmDraftItem["editedPayload"]["primerMeta"]) {
  return data?.targetName || data?.isReferenceGene
    ? {
        create: {
          targetName: data?.targetName,
          isReferenceGene: data?.isReferenceGene ?? false,
        },
      }
    : undefined;
}

export async function confirmReagentDraft(input: ConfirmDraftItem): Promise<ConfirmReagentResult> {
  return prisma.$transaction(async (tx) => {
    const draft = await tx.reagentParseDraft.findUnique({ where: { id: input.draftId } });
    if (!draft || draft.isConfirmed) {
      throw new Error("INVALID_DRAFT");
    }

    const p = input.editedPayload;
    const existing = await tx.reagent.findUnique({
      where: {
        labId_catalogNo: {
          labId: p.labId,
          catalogNo: p.catalogNo,
        },
      },
    });

    if (existing) {
      const incremented = buildIncrementResult(existing.id, existing.quantity);
      await tx.reagent.update({
        where: { id: existing.id },
        data: { quantity: incremented.afterQuantity },
      });
      await tx.reagentParseDraft.update({ where: { id: draft.id }, data: { isConfirmed: true } });
      return incremented;
    }

    const reagent = await tx.reagent.create({
      data: {
        labId: p.labId,
        name: p.name,
        catalogNo: p.catalogNo,
        category: p.category,
        subCategory: p.subCategory,
        vendor: p.vendor,
        note: p.note,
        quantity: 1,
        experimentTags: p.experimentTags,
        antibodyMeta: createAntibodyMeta(p.antibodyMeta),
        primerMeta: createPrimerMeta(p.primerMeta),
      },
    });

    await tx.reagentParseDraft.update({ where: { id: draft.id }, data: { isConfirmed: true } });
    return { action: "created", reagentId: reagent.id };
  });
}
