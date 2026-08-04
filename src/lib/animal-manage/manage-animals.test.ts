import assert from "node:assert/strict";
import test from "node:test";

test("rack summaries derive each cage's mouse count rather than Array.map's index", async () => {
  const globalWithPrisma = globalThis as typeof globalThis & { prisma?: unknown };
  const priorPrisma = globalWithPrisma.prisma;
  const queriedAt = new Date("2026-08-04T00:00:00.000Z");

  globalWithPrisma.prisma = {
    animalRack: {
      findMany: async () => [{
        id: "rack-1",
        labId: "lab-1",
        name: "测试笼架",
        cages: [
          { id: "cage-a1", rowIndex: 1, columnIndex: 1, movedInAt: queriedAt, initialAgeWeeks: 6, mice: [{}, {}, {}, {}, {}] },
          { id: "cage-b1", rowIndex: 1, columnIndex: 2, movedInAt: queriedAt, initialAgeWeeks: 6, mice: [{}, {}, {}] },
        ],
      }],
    },
  };

  try {
    const { listAnimalRacks } = await import("@/lib/animal-manage/manage-animals");
    const [rack] = await listAnimalRacks("lab-1");
    assert.deepEqual(rack.cages.map((cage) => cage.mouseCount), [5, 3]);
  } finally {
    if (priorPrisma === undefined) delete globalWithPrisma.prisma;
    else globalWithPrisma.prisma = priorPrisma;
  }
});
