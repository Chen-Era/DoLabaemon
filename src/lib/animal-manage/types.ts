import { z } from "zod";

export const MAX_RACK_ROWS = 26;
export const MAX_RACK_COLUMNS = 26;
export const MAX_CAGE_MOUSE_COUNT = 500;

export const animalSexValues = ["MALE", "FEMALE", "MIXED", "UNKNOWN"] as const;
export const animalOperationScopeValues = ["MOUSE", "CAGE", "RACK"] as const;

const nullableTrimmedString = (max: number) => z.string().trim().max(max).nullable().optional();

const dateInputSchema = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .refine((value) => !Number.isNaN(Date.parse(value)), { message: "INVALID_DATE" });

const optionalDateInputSchema = z
  .string()
  .trim()
  .max(40)
  .refine((value) => !value || !Number.isNaN(Date.parse(value)), { message: "INVALID_DATE" })
  .nullable()
  .optional();

const positionFields = {
  rowIndex: z.number().int().min(1).max(MAX_RACK_ROWS),
  columnIndex: z.number().int().min(1).max(MAX_RACK_COLUMNS),
};

const cageCardFields = {
  movedInAt: dateInputSchema,
  initialAgeWeeks: z.number().finite().min(0).max(260),
  strain: nullableTrimmedString(200),
  sex: z.enum(animalSexValues).default("UNKNOWN"),
  genotype: nullableTrimmedString(500),
  note: nullableTrimmedString(2_000),
};

/** Turns one-based rack coordinates into the user-facing Excel-style name. */
export function cagePositionName(columnIndex: number, rowIndex: number) {
  if (
    !Number.isInteger(columnIndex) ||
    !Number.isInteger(rowIndex) ||
    columnIndex < 1 ||
    columnIndex > MAX_RACK_COLUMNS ||
    rowIndex < 1 ||
    rowIndex > MAX_RACK_ROWS
  ) {
    throw new Error("INVALID_CAGE_POSITION");
  }
  return `${String.fromCharCode(64 + columnIndex)}${rowIndex}`;
}

export function makeActiveSlotKey(rackId: string, columnIndex: number, rowIndex: number) {
  return `${rackId}:${cagePositionName(columnIndex, rowIndex)}`;
}

export function calculateCurrentAgeWeeks(
  initialAgeWeeks: number,
  movedInAt: Date | string,
  referenceDate: Date = new Date(),
) {
  const movedInTime = new Date(movedInAt).getTime();
  const referenceTime = referenceDate.getTime();
  if (!Number.isFinite(movedInTime) || !Number.isFinite(referenceTime)) return initialAgeWeeks;
  const elapsedWeeks = Math.max(0, referenceTime - movedInTime) / (7 * 24 * 60 * 60 * 1_000);
  return Math.round((initialAgeWeeks + elapsedWeeks) * 10) / 10;
}

export const animalRackCreateSchema = z.object({
  labId: z.string().trim().min(1),
  name: z.string().trim().min(1).max(100),
  rows: z.number().int().min(1).max(MAX_RACK_ROWS).default(8),
  columns: z.number().int().min(1).max(MAX_RACK_COLUMNS).default(8),
  note: nullableTrimmedString(2_000),
});

export const animalRackUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    rows: z.number().int().min(1).max(MAX_RACK_ROWS).optional(),
    columns: z.number().int().min(1).max(MAX_RACK_COLUMNS).optional(),
    note: nullableTrimmedString(2_000),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), { message: "EMPTY_UPDATE" });

export const animalCageCreateSchema = z.object({
  labId: z.string().trim().min(1),
  rackId: z.string().trim().min(1),
  ...positionFields,
  ...cageCardFields,
  mouseCount: z.number().int().min(0).max(MAX_CAGE_MOUSE_COUNT),
  mouseIdentifiers: z.array(z.string().trim().min(1).max(100)).max(MAX_CAGE_MOUSE_COUNT).default([]),
}).superRefine((value, ctx) => {
  if (value.mouseIdentifiers.length > value.mouseCount) {
    ctx.addIssue({
      code: "custom",
      path: ["mouseIdentifiers"],
      message: "IDENTIFIERS_EXCEED_MOUSE_COUNT",
    });
  }
});

/** Creates identical cage cards in several empty positions of one rack. */
export const animalCageBatchCreateSchema = z.object({
  labId: z.string().trim().min(1),
  rackId: z.string().trim().min(1),
  positions: z.array(z.object(positionFields)).min(1).max(MAX_RACK_ROWS * MAX_RACK_COLUMNS),
  ...cageCardFields,
  mouseCount: z.number().int().min(0).max(MAX_CAGE_MOUSE_COUNT),
}).superRefine((value, ctx) => {
  const seen = new Set<string>();
  value.positions.forEach((position, index) => {
    const key = `${position.columnIndex}:${position.rowIndex}`;
    if (seen.has(key)) {
      ctx.addIssue({ code: "custom", path: ["positions", index], message: "DUPLICATE_CAGE_POSITION" });
    }
    seen.add(key);
  });
});

export const animalCageUpdateSchema = z
  .object(cageCardFields)
  .partial()
  .refine((value) => Object.values(value).some((item) => item !== undefined), { message: "EMPTY_UPDATE" });

/**
 * Closes the current cage card and releases its Excel-style position for a
 * replacement card. Any still-active residents are marked as having left at
 * the reset time; their mouse and operation history is retained.
 */
export const animalCageResetSchema = z.object({
  resetAt: optionalDateInputSchema,
  reason: nullableTrimmedString(500),
});

export const animalResidentUpdateSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("ADMIT"),
    count: z.number().int().min(1).max(MAX_CAGE_MOUSE_COUNT),
    movedAt: optionalDateInputSchema,
    identifiers: z.array(z.string().trim().min(1).max(100)).max(MAX_CAGE_MOUSE_COUNT).default([]),
    note: nullableTrimmedString(2_000),
  }).superRefine((value, ctx) => {
    if (value.identifiers.length > value.count) {
      ctx.addIssue({ code: "custom", path: ["identifiers"], message: "IDENTIFIERS_EXCEED_MOUSE_COUNT" });
    }
  }),
  z.object({
    action: z.literal("DEPART"),
    mouseIds: z.array(z.string().trim().min(1)).min(1).max(MAX_CAGE_MOUSE_COUNT).optional(),
    count: z.number().int().min(1).max(MAX_CAGE_MOUSE_COUNT).optional(),
    movedAt: optionalDateInputSchema,
    leaveReason: nullableTrimmedString(500),
  }).superRefine((value, ctx) => {
    if (!value.mouseIds?.length && !value.count) {
      ctx.addIssue({ code: "custom", path: ["count"], message: "MOUSE_IDS_OR_COUNT_REQUIRED" });
    }
  }),
]);

const batchAdmissionBaseFields = {
  labId: z.string().trim().min(1),
  /** Number of mice to add to every target cage. */
  count: z.number().int().min(1).max(MAX_CAGE_MOUSE_COUNT),
  movedAt: optionalDateInputSchema,
  note: nullableTrimmedString(2_000),
};

/** Adds the same number of mice to a hand-picked cage set or every active cage in a rack. */
export const animalBatchAdmissionSchema = z.discriminatedUnion("sourceScope", [
  z.object({
    ...batchAdmissionBaseFields,
    sourceScope: z.literal("CAGE"),
    cageIds: z.array(z.string().trim().min(1)).min(1).max(500),
  }),
  z.object({
    ...batchAdmissionBaseFields,
    sourceScope: z.literal("RACK"),
    rackId: z.string().trim().min(1),
  }),
]);

const operationBaseFields = {
  labId: z.string().trim().min(1),
  operationType: z.string().trim().min(1).max(100),
  operationAt: optionalDateInputSchema,
  note: nullableTrimmedString(2_000),
};

export const animalOperationCreateSchema = z.discriminatedUnion("sourceScope", [
  z.object({
    ...operationBaseFields,
    sourceScope: z.literal("MOUSE"),
    mouseIds: z.array(z.string().trim().min(1)).min(1).max(5_000),
  }),
  z.object({
    ...operationBaseFields,
    sourceScope: z.literal("CAGE"),
    cageIds: z.array(z.string().trim().min(1)).min(1).max(500),
  }),
  z.object({
    ...operationBaseFields,
    sourceScope: z.literal("RACK"),
    rackId: z.string().trim().min(1),
  }),
]);

export type AnimalRackCreateInput = z.infer<typeof animalRackCreateSchema>;
export type AnimalRackUpdateInput = z.infer<typeof animalRackUpdateSchema>;
export type AnimalCageCreateInput = z.infer<typeof animalCageCreateSchema>;
export type AnimalCageBatchCreateInput = z.infer<typeof animalCageBatchCreateSchema>;
export type AnimalCageUpdateInput = z.infer<typeof animalCageUpdateSchema>;
export type AnimalCageResetInput = z.infer<typeof animalCageResetSchema>;
export type AnimalResidentUpdateInput = z.infer<typeof animalResidentUpdateSchema>;
export type AnimalBatchAdmissionInput = z.infer<typeof animalBatchAdmissionSchema>;
export type AnimalOperationCreateInput = z.infer<typeof animalOperationCreateSchema>;
