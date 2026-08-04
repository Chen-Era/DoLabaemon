import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  calculateCurrentAgeWeeks,
  cagePositionName,
  makeActiveSlotKey,
  type AnimalCageBatchCreateInput,
  type AnimalCageCreateInput,
  type AnimalCageResetInput,
  type AnimalCageUpdateInput,
  type AnimalBatchAdmissionInput,
  type AnimalOperationCreateInput,
  type AnimalRackCreateInput,
  type AnimalRackUpdateInput,
  type AnimalResidentUpdateInput,
} from "@/lib/animal-manage/types";

const activeMouseInclude = {
  where: { status: "ACTIVE" as const },
  orderBy: [{ movedInAt: "asc" as const }, { createdAt: "asc" as const }],
};

const activeCageInclude = {
  where: { status: "ACTIVE" as const },
  orderBy: [{ rowIndex: "asc" as const }, { columnIndex: "asc" as const }],
  include: { mice: activeMouseInclude },
};

function dateFromInput(value?: string | null) {
  if (!value) return new Date();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("INVALID_DATE");
  return date;
}

function serializeCage<T extends {
  rowIndex: number;
  columnIndex: number;
  movedInAt: Date;
  initialAgeWeeks: number;
  mice?: Array<unknown>;
}>(cage: T, mouseCount = cage.mice?.length ?? 0) {
  return {
    ...cage,
    positionName: cagePositionName(cage.columnIndex, cage.rowIndex),
    currentAgeWeeks: calculateCurrentAgeWeeks(cage.initialAgeWeeks, cage.movedInAt),
    mouseCount,
  };
}

function serializeRack<T extends { cages: Array<{ rowIndex: number; columnIndex: number; movedInAt: Date; initialAgeWeeks: number; mice?: Array<unknown> }> }>(rack: T) {
  // Do not pass serializeCage directly to Array.map: map's second argument is
  // the row index, which otherwise overwrites the derived resident count.
  return { ...rack, cages: rack.cages.map((cage) => serializeCage(cage)) };
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function getAnimalRackAccessContext(rackId: string) {
  const rack = await prisma.animalRack.findUnique({
    where: { id: rackId },
    select: { id: true, labId: true },
  });
  if (!rack) throw new Error("ANIMAL_RACK_NOT_FOUND");
  return rack;
}

export async function getAnimalCageAccessContext(cageId: string) {
  const cage = await prisma.animalCage.findUnique({
    where: { id: cageId },
    select: { id: true, rack: { select: { labId: true } } },
  });
  if (!cage) throw new Error("ANIMAL_CAGE_NOT_FOUND");
  return { id: cage.id, labId: cage.rack.labId };
}

export async function listAnimalRacks(labId: string) {
  const racks = await prisma.animalRack.findMany({
    where: { labId },
    orderBy: [{ name: "asc" }, { createdAt: "asc" }],
    include: { cages: activeCageInclude },
  });
  return racks.map(serializeRack);
}

export async function getAnimalRack(rackId: string) {
  const rack = await prisma.animalRack.findUnique({
    where: { id: rackId },
    include: {
      cages: {
        where: { status: "ACTIVE" },
        orderBy: [{ rowIndex: "asc" }, { columnIndex: "asc" }],
        include: {
          mice: {
            orderBy: [{ status: "asc" }, { movedInAt: "asc" }],
            include: { operations: { orderBy: [{ operationAt: "desc" }, { createdAt: "desc" }] } },
          },
        },
      },
    },
  });
  if (!rack) throw new Error("ANIMAL_RACK_NOT_FOUND");
  return {
    ...rack,
    cages: rack.cages.map((cage) => serializeCage(
      cage,
      cage.mice.filter((mouse) => mouse.status === "ACTIVE").length,
    )),
  };
}

export async function createAnimalRack(input: AnimalRackCreateInput) {
  return prisma.animalRack.create({
    data: {
      labId: input.labId,
      name: input.name,
      rows: input.rows,
      columns: input.columns,
      note: input.note ?? null,
    },
    include: { cages: activeCageInclude },
  }).then(serializeRack);
}

export async function updateAnimalRack(rackId: string, input: AnimalRackUpdateInput) {
  return prisma.$transaction(async (tx) => {
    const rack = await tx.animalRack.findUnique({ where: { id: rackId } });
    if (!rack) throw new Error("ANIMAL_RACK_NOT_FOUND");
    const rows = input.rows ?? rack.rows;
    const columns = input.columns ?? rack.columns;
    const outOfBoundsCage = await tx.animalCage.findFirst({
      where: {
        rackId,
        status: "ACTIVE",
        OR: [{ rowIndex: { gt: rows } }, { columnIndex: { gt: columns } }],
      },
      select: { id: true },
    });
    if (outOfBoundsCage) throw new Error("RACK_RESIZE_CONFLICT");

    const updated = await tx.animalRack.update({
      where: { id: rackId },
      data: {
        name: input.name,
        rows: input.rows,
        columns: input.columns,
        note: input.note,
      },
      include: { cages: activeCageInclude },
    });
    return serializeRack(updated);
  });
}

export async function createAnimalCage(input: AnimalCageCreateInput, createdById: string) {
  try {
    return await prisma.$transaction(async (tx) => {
      const rack = await tx.animalRack.findUnique({ where: { id: input.rackId }, select: { labId: true, rows: true, columns: true } });
      if (!rack || rack.labId !== input.labId) throw new Error("ANIMAL_RACK_NOT_FOUND");
      if (input.rowIndex > rack.rows || input.columnIndex > rack.columns) {
        throw new Error("CAGE_POSITION_OUTSIDE_RACK");
      }

      const movedInAt = dateFromInput(input.movedInAt);
      const cage = await tx.animalCage.create({
        data: {
          rackId: input.rackId,
          rowIndex: input.rowIndex,
          columnIndex: input.columnIndex,
          activeSlotKey: makeActiveSlotKey(input.rackId, input.columnIndex, input.rowIndex),
          movedInAt,
          initialAgeWeeks: input.initialAgeWeeks,
          strain: input.strain ?? null,
          sex: input.sex,
          genotype: input.genotype?.trim() || "WT",
          note: input.note ?? null,
        },
      });
      const mice = Array.from({ length: input.mouseCount }, (_, index) => ({
        id: randomUUID(),
        labId: input.labId,
        cageId: cage.id,
        identifier: input.mouseIdentifiers?.[index] ?? null,
        movedInAt,
      }));
      if (mice.length) {
        await tx.animalMouse.createMany({ data: mice });
        await tx.animalOperation.createMany({
          data: mice.map((mouse) => ({
            labId: input.labId,
            mouseId: mouse.id,
            cageId: cage.id,
            operationType: "入驻",
            operationAt: movedInAt,
            sourceScope: "SYSTEM",
            createdById,
          })),
        });
      }
      const created = await tx.animalCage.findUniqueOrThrow({ where: { id: cage.id }, include: { mice: activeMouseInclude } });
      return serializeCage(created);
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) throw new Error("CAGE_POSITION_OCCUPIED");
    throw error;
  }
}

/** Creates several cage cards and their initial resident records in one atomic transaction. */
export async function createAnimalCagesBatch(input: AnimalCageBatchCreateInput, createdById: string) {
  try {
    return await prisma.$transaction(async (tx) => {
      const rack = await tx.animalRack.findUnique({ where: { id: input.rackId }, select: { labId: true, rows: true, columns: true } });
      if (!rack || rack.labId !== input.labId) throw new Error("ANIMAL_RACK_NOT_FOUND");
      if (input.positions.some((position) => position.rowIndex > rack.rows || position.columnIndex > rack.columns)) {
        throw new Error("CAGE_POSITION_OUTSIDE_RACK");
      }

      const slotKeys = input.positions.map((position) => makeActiveSlotKey(input.rackId, position.columnIndex, position.rowIndex));
      const occupied = await tx.animalCage.findFirst({ where: { activeSlotKey: { in: slotKeys } }, select: { id: true } });
      if (occupied) throw new Error("CAGE_POSITION_OCCUPIED");

      const movedInAt = dateFromInput(input.movedInAt);
      const cages = input.positions.map((position) => ({
        id: randomUUID(),
        rackId: input.rackId,
        rowIndex: position.rowIndex,
        columnIndex: position.columnIndex,
        activeSlotKey: makeActiveSlotKey(input.rackId, position.columnIndex, position.rowIndex),
        movedInAt,
        initialAgeWeeks: input.initialAgeWeeks,
        strain: input.strain ?? null,
        sex: input.sex,
        genotype: input.genotype?.trim() || "WT",
        note: input.note ?? null,
      }));
      await tx.animalCage.createMany({ data: cages });

      const mice = cages.flatMap((cage) => Array.from({ length: input.mouseCount }, () => ({
        id: randomUUID(),
        labId: input.labId,
        cageId: cage.id,
        movedInAt,
      })));
      if (mice.length) {
        const batchId = randomUUID();
        await tx.animalMouse.createMany({ data: mice });
        await tx.animalOperation.createMany({
          data: mice.map((mouse) => ({
            labId: input.labId,
            mouseId: mouse.id,
            cageId: mouse.cageId,
            operationType: "入驻",
            operationAt: movedInAt,
            sourceScope: "CAGE",
            batchId,
            createdById,
          })),
        });
      }
      const created = await tx.animalCage.findMany({ where: { id: { in: cages.map((cage) => cage.id) } }, include: { mice: activeMouseInclude } });
      const createdByCageId = new Map(created.map((cage) => [cage.id, serializeCage(cage)]));
      return cages.map((cage) => createdByCageId.get(cage.id)!);
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) throw new Error("CAGE_POSITION_OCCUPIED");
    throw error;
  }
}

export async function updateAnimalCage(cageId: string, input: AnimalCageUpdateInput) {
  const cage = await prisma.animalCage.findUnique({ where: { id: cageId }, select: { id: true, status: true } });
  if (!cage) throw new Error("ANIMAL_CAGE_NOT_FOUND");
  if (cage.status !== "ACTIVE") throw new Error("ANIMAL_CAGE_CLOSED");
  const updated = await prisma.animalCage.update({
    where: { id: cageId },
    data: {
      movedInAt: input.movedInAt ? dateFromInput(input.movedInAt) : undefined,
      initialAgeWeeks: input.initialAgeWeeks,
      strain: input.strain,
      sex: input.sex,
      genotype: input.genotype === null ? "WT" : input.genotype,
      note: input.note,
    },
    include: { mice: activeMouseInclude },
  });
  return serializeCage(updated);
}

/**
 * Retires an in-use cage card without deleting its audit trail.  The unique
 * active slot key is released only after all active mice have been recorded
 * as leaving, so a new card can safely be created in the same position.
 */
export async function resetAnimalCage(cageId: string, input: AnimalCageResetInput, createdById: string) {
  return prisma.$transaction(async (tx) => {
    const cage = await tx.animalCage.findUnique({
      where: { id: cageId },
      include: {
        rack: { select: { labId: true } },
        mice: { where: { status: "ACTIVE" }, select: { id: true } },
      },
    });
    if (!cage) throw new Error("ANIMAL_CAGE_NOT_FOUND");
    if (cage.status !== "ACTIVE") throw new Error("ANIMAL_CAGE_CLOSED");

    const resetAt = dateFromInput(input.resetAt);
    const activeMouseIds = cage.mice.map((mouse) => mouse.id);
    const reason = input.reason?.trim() || "笼牌重置";

    if (activeMouseIds.length) {
      await tx.animalMouse.updateMany({
        where: { id: { in: activeMouseIds }, status: "ACTIVE" },
        data: { status: "LEFT", movedOutAt: resetAt, leaveReason: reason },
      });
      await tx.animalOperation.createMany({
        data: activeMouseIds.map((mouseId) => ({
          labId: cage.rack.labId,
          mouseId,
          cageId,
          operationType: "笼牌重置",
          operationAt: resetAt,
          note: reason,
          sourceScope: "SYSTEM",
          createdById,
        })),
      });
    }

    await tx.animalCage.update({
      where: { id: cageId },
      data: { status: "CLOSED", activeSlotKey: null, closedAt: resetAt },
    });

    return { cageId, resetAt, departedMouseIds: activeMouseIds };
  });
}

export async function updateAnimalCageResidents(
  cageId: string,
  input: AnimalResidentUpdateInput,
  createdById: string,
) {
  return prisma.$transaction(async (tx) => {
    const cage = await tx.animalCage.findUnique({
      where: { id: cageId },
      include: { rack: { select: { labId: true } }, mice: activeMouseInclude },
    });
    if (!cage) throw new Error("ANIMAL_CAGE_NOT_FOUND");
    if (cage.status !== "ACTIVE") throw new Error("ANIMAL_CAGE_CLOSED");

    if (input.action === "ADMIT") {
      const movedInAt = dateFromInput(input.movedAt);
      const created = await Promise.all(Array.from({ length: input.count }, (_, index) => tx.animalMouse.create({
        data: {
          labId: cage.rack.labId,
          cageId,
          identifier: input.identifiers?.[index] ?? null,
          movedInAt,
          note: input.note ?? null,
        },
      })));
      await tx.animalOperation.createMany({
        data: created.map((mouse) => ({
          labId: cage.rack.labId,
          mouseId: mouse.id,
          cageId,
          operationType: "入驻",
          operationAt: movedInAt,
          note: input.note ?? null,
          sourceScope: "SYSTEM",
          createdById,
        })),
      });
      const refreshed = await tx.animalCage.findUniqueOrThrow({ where: { id: cageId }, include: { mice: activeMouseInclude } });
      return { cage: serializeCage(refreshed), admittedMouseIds: created.map((mouse) => mouse.id), departedMouseIds: [] };
    }

    const selected = input.mouseIds?.length
      ? cage.mice.filter((mouse) => input.mouseIds!.includes(mouse.id))
      : cage.mice.slice(0, input.count);
    const requestedCount = input.mouseIds?.length ?? input.count ?? 0;
    if (selected.length !== requestedCount) throw new Error("ANIMAL_MOUSE_NOT_FOUND");
    const movedOutAt = dateFromInput(input.movedAt);
    const selectedIds = selected.map((mouse) => mouse.id);
    await tx.animalMouse.updateMany({
      where: { id: { in: selectedIds } },
      data: { status: "LEFT", movedOutAt, leaveReason: input.leaveReason ?? null },
    });
    await tx.animalOperation.createMany({
      data: selectedIds.map((mouseId) => ({
        labId: cage.rack.labId,
        mouseId,
        cageId,
        operationType: "离笼",
        operationAt: movedOutAt,
        note: input.leaveReason ?? null,
        sourceScope: "SYSTEM",
        createdById,
      })),
    });
    const refreshed = await tx.animalCage.findUniqueOrThrow({ where: { id: cageId }, include: { mice: activeMouseInclude } });
    return { cage: serializeCage(refreshed), admittedMouseIds: [], departedMouseIds: selectedIds };
  });
}

/** Creates auditable entry records while adding the same number of mice to each target cage. */
export async function admitAnimalCageResidentsBatch(input: AnimalBatchAdmissionInput, createdById: string) {
  return prisma.$transaction(async (tx) => {
    let cages: Array<{ id: string }> = [];
    if (input.sourceScope === "CAGE") {
      const cageIds = [...new Set(input.cageIds)];
      cages = await tx.animalCage.findMany({
        where: { id: { in: cageIds }, status: "ACTIVE", rack: { labId: input.labId } },
        select: { id: true },
      });
      if (cages.length !== cageIds.length) throw new Error("ANIMAL_CAGE_NOT_FOUND");
    } else {
      const rack = await tx.animalRack.findFirst({
        where: { id: input.rackId, labId: input.labId },
        select: { id: true },
      });
      if (!rack) throw new Error("ANIMAL_RACK_NOT_FOUND");
      cages = await tx.animalCage.findMany({
        where: { rackId: rack.id, status: "ACTIVE" },
        select: { id: true },
      });
    }
    if (!cages.length) throw new Error("NO_ACTIVE_CAGES");

    const movedInAt = dateFromInput(input.movedAt);
    const batchId = randomUUID();
    const created = await Promise.all(cages.flatMap((cage) => (
      Array.from({ length: input.count }, () => tx.animalMouse.create({
        data: {
          labId: input.labId,
          cageId: cage.id,
          movedInAt,
          note: input.note ?? null,
        },
        select: { id: true, cageId: true },
      }))
    )));
    await tx.animalOperation.createMany({
      data: created.map((mouse) => ({
        labId: input.labId,
        mouseId: mouse.id,
        cageId: mouse.cageId,
        operationType: "入驻",
        operationAt: movedInAt,
        note: input.note ?? null,
        sourceScope: input.sourceScope,
        batchId,
        createdById,
      })),
    });
    return {
      batchId,
      affectedCageCount: cages.length,
      admittedCount: created.length,
      cageIds: cages.map((cage) => cage.id),
    };
  });
}

export async function createAnimalOperations(input: AnimalOperationCreateInput, createdById: string) {
  return prisma.$transaction(async (tx) => {
    let mice: Array<{ id: string; cageId: string }> = [];
    if (input.sourceScope === "MOUSE") {
      const ids = [...new Set(input.mouseIds)];
      mice = await tx.animalMouse.findMany({ where: { labId: input.labId, id: { in: ids } }, select: { id: true, cageId: true } });
      if (mice.length !== ids.length) throw new Error("ANIMAL_MOUSE_NOT_FOUND");
    } else if (input.sourceScope === "CAGE") {
      const cageIds = [...new Set(input.cageIds)];
      const cages = await tx.animalCage.findMany({
        where: { id: { in: cageIds }, status: "ACTIVE", rack: { labId: input.labId } },
        select: { id: true, mice: { where: { status: "ACTIVE" }, select: { id: true, cageId: true } } },
      });
      if (cages.length !== cageIds.length) throw new Error("ANIMAL_CAGE_NOT_FOUND");
      mice = cages.flatMap((cage) => cage.mice);
    } else {
      const rack = await tx.animalRack.findFirst({ where: { id: input.rackId, labId: input.labId }, select: { id: true } });
      if (!rack) throw new Error("ANIMAL_RACK_NOT_FOUND");
      mice = await tx.animalMouse.findMany({
        where: { labId: input.labId, status: "ACTIVE", cage: { rackId: rack.id, status: "ACTIVE" } },
        select: { id: true, cageId: true },
      });
    }
    if (!mice.length) throw new Error("NO_ACTIVE_MICE");

    const batchId = randomUUID();
    const operationAt = dateFromInput(input.operationAt);
    await tx.animalOperation.createMany({
      data: mice.map((mouse) => ({
        labId: input.labId,
        mouseId: mouse.id,
        cageId: mouse.cageId,
        operationType: input.operationType,
        operationAt,
        note: input.note ?? null,
        sourceScope: input.sourceScope,
        batchId,
        createdById,
      })),
    });
    return { batchId, createdCount: mice.length, mouseIds: mice.map((mouse) => mouse.id) };
  });
}
