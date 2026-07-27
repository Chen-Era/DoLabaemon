import { z } from "zod";
import { experimentTags } from "@/lib/rules/catalog";
import { antibodyMetaSchema, primerMetaSchema, reagentCategoryValues } from "@/lib/reagent-ingest/types";

const nullableTrimmedString = (max: number) => z.string().trim().max(max).nullable().optional();

const dateInputSchema = z
  .string()
  .trim()
  .max(40)
  .refine((value) => !value || !Number.isNaN(Date.parse(value)), { message: "INVALID_DATE" })
  .nullable()
  .optional();

const quantitySchema = z.number().finite().min(0).max(1_000_000_000).nullable().optional();

const reagentWriteFields = {
  name: z.string().trim().min(1).max(200),
  catalogNo: z.string().trim().min(1).max(100),
  category: z.enum(reagentCategoryValues),
  subCategory: nullableTrimmedString(100),
  vendor: nullableTrimmedString(200),
  note: nullableTrimmedString(2000),
  storageCondition: nullableTrimmedString(200),
  unit: nullableTrimmedString(50),
  quantity: quantitySchema,
  arrivalDate: dateInputSchema,
  expiryDate: dateInputSchema,
  experimentTags: z.array(z.enum(experimentTags)).default([]),
  antibodyMeta: antibodyMetaSchema,
  primerMeta: primerMetaSchema,
};

export const reagentCreateSchema = z.object({
  labId: z.string().min(1),
  ...reagentWriteFields,
});

export const reagentUpdateSchema = z.object(reagentWriteFields);

export const adjustQuantitySchema = z.object({
  reagentId: z.string().min(1),
  delta: z
    .number()
    .finite()
    .min(-1_000_000)
    .max(1_000_000)
    .refine((value) => value !== 0, { message: "DELTA_MUST_BE_NON_ZERO" }),
});

export const batchDeleteSchema = z.object({
  labId: z.string().min(1),
  ids: z.array(z.string().min(1)).min(1).max(500),
});

export type ReagentCreateInput = z.infer<typeof reagentCreateSchema>;
export type ReagentUpdateInput = z.infer<typeof reagentUpdateSchema>;
export type AdjustQuantityInput = z.infer<typeof adjustQuantitySchema>;
export type BatchDeleteInput = z.infer<typeof batchDeleteSchema>;
