import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ReagentCreateInput, ReagentUpdateInput } from "@/lib/reagent-manage/types";
import { buildReagentUploadProvenance, type ReagentUploader } from "@/lib/reagent-provenance";

const REAGENT_INCLUDE = { antibodyMeta: true, primerMeta: true } as const;

export function parseDateInput(value?: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function roundQuantity(value: number) {
  return Math.round(value * 1000) / 1000;
}

export function normalizeQuantityInput(value?: number | null): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return roundQuantity(Math.max(0, value));
}

export function computeAdjustedQuantity(current: number | null | undefined, delta: number) {
  const baseline = typeof current === "number" && Number.isFinite(current) ? current : 0;
  return roundQuantity(Math.max(0, baseline + delta));
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function antibodyMetaData(meta: ReagentCreateInput["antibodyMeta"]) {
  return meta?.role
    ? {
        role: meta.role,
        hostSpecies: meta.hostSpecies ?? null,
        targetSpecies: meta.targetSpecies ?? null,
        targetName: meta.targetName ?? null,
      }
    : null;
}

function primerMetaData(meta: ReagentCreateInput["primerMeta"]) {
  return meta && (meta.targetName || meta.isReferenceGene)
    ? {
        targetName: meta.targetName ?? null,
        isReferenceGene: meta.isReferenceGene ?? false,
      }
    : null;
}

function writeData(input: ReagentCreateInput | ReagentUpdateInput) {
  return {
    name: input.name,
    catalogNo: input.catalogNo,
    category: input.category,
    subCategory: input.subCategory ?? null,
    vendor: input.vendor ?? null,
    note: input.note ?? null,
    storageCondition: input.storageCondition ?? null,
    unit: input.unit ?? null,
    quantity: normalizeQuantityInput(input.quantity),
    arrivalDate: parseDateInput(input.arrivalDate),
    expiryDate: parseDateInput(input.expiryDate),
    experimentTags: input.experimentTags ?? [],
  };
}

export async function getReagentAccessContext(reagentId: string) {
  const reagent = await prisma.reagent.findUnique({
    where: { id: reagentId },
    select: { id: true, labId: true },
  });
  if (!reagent) {
    throw new Error("REAGENT_NOT_FOUND");
  }
  return reagent;
}

export async function createReagent(input: ReagentCreateInput, uploader: ReagentUploader) {
  const existing = await prisma.reagent.findUnique({
    where: { labId_catalogNo: { labId: input.labId, catalogNo: input.catalogNo } },
    select: { id: true },
  });
  if (existing) {
    throw new Error("CATALOG_NO_EXISTS");
  }
  const antibody = antibodyMetaData(input.antibodyMeta);
  const primer = primerMetaData(input.primerMeta);
  try {
    return await prisma.reagent.create({
      data: {
        labId: input.labId,
        ...writeData(input),
        ...buildReagentUploadProvenance(uploader),
        antibodyMeta: antibody ? { create: antibody } : undefined,
        primerMeta: primer ? { create: primer } : undefined,
      },
      include: REAGENT_INCLUDE,
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new Error("CATALOG_NO_EXISTS");
    }
    throw error;
  }
}

export async function updateReagent(reagentId: string, input: ReagentUpdateInput) {
  return prisma
    .$transaction(async (tx) => {
      const existing = await tx.reagent.findUnique({ where: { id: reagentId } });
      if (!existing) {
        throw new Error("REAGENT_NOT_FOUND");
      }
      if (input.catalogNo !== existing.catalogNo) {
        const conflict = await tx.reagent.findUnique({
          where: { labId_catalogNo: { labId: existing.labId, catalogNo: input.catalogNo } },
          select: { id: true },
        });
        if (conflict) {
          throw new Error("CATALOG_NO_EXISTS");
        }
      }

      const antibody = antibodyMetaData(input.antibodyMeta);
      if (antibody) {
        await tx.antibodyMeta.upsert({
          where: { reagentId },
          create: { reagentId, ...antibody },
          update: antibody,
        });
      } else {
        await tx.antibodyMeta.deleteMany({ where: { reagentId } });
      }

      const primer = primerMetaData(input.primerMeta);
      if (primer) {
        await tx.primerMeta.upsert({
          where: { reagentId },
          create: { reagentId, ...primer },
          update: primer,
        });
      } else {
        await tx.primerMeta.deleteMany({ where: { reagentId } });
      }

      return tx.reagent.update({
        where: { id: reagentId },
        data: writeData(input),
        include: REAGENT_INCLUDE,
      });
    })
    .catch((error: unknown) => {
      if (isUniqueConstraintError(error)) {
        throw new Error("CATALOG_NO_EXISTS");
      }
      throw error;
    });
}

export async function deleteReagent(reagentId: string) {
  try {
    await prisma.reagent.delete({ where: { id: reagentId } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new Error("REAGENT_NOT_FOUND");
    }
    throw error;
  }
  return { deletedReagentId: reagentId };
}

export async function deleteReagents(labId: string, ids: string[]) {
  const result = await prisma.reagent.deleteMany({
    where: { labId, id: { in: ids } },
  });
  return { deletedCount: result.count };
}

export async function adjustReagentQuantity(reagentId: string, delta: number) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.reagent.findUnique({
      where: { id: reagentId },
      select: { id: true, quantity: true },
    });
    if (!existing) {
      throw new Error("REAGENT_NOT_FOUND");
    }
    const beforeQuantity = existing.quantity;
    const afterQuantity = computeAdjustedQuantity(beforeQuantity, delta);
    await tx.reagent.update({
      where: { id: reagentId },
      data: { quantity: afterQuantity },
    });
    return { reagentId, beforeQuantity, afterQuantity };
  });
}
