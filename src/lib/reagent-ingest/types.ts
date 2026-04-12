import { z } from "zod";
import { experimentTags, type ExperimentTag } from "@/lib/rules/catalog";

export const reagentCategoryValues = ["ANTIBODY", "BUFFER", "KIT", "PRIMER", "BIOLOGICAL", "CHEMICAL", "CONSUMABLE", "OTHER"] as const;
export const antibodyRoleValues = ["PRIMARY", "SECONDARY"] as const;

export const antibodyMetaSchema = z
  .object({
    role: z.enum(antibodyRoleValues).nullable().optional(),
    hostSpecies: z.string().nullable().optional(),
    targetSpecies: z.string().nullable().optional(),
    targetName: z.string().nullable().optional(),
  })
  .nullable()
  .optional();

export const primerMetaSchema = z
  .object({
    targetName: z.string().nullable().optional(),
    isReferenceGene: z.boolean().nullable().optional(),
  })
  .nullable()
  .optional();

export const confirmEditedPayloadSchema = z.object({
  labId: z.string().min(1),
  name: z.string().min(1),
  catalogNo: z.string().min(1),
  category: z.enum(reagentCategoryValues),
  subCategory: z.string().optional().nullable(),
  vendor: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  experimentTags: z.array(z.enum(experimentTags)).default([]),
  antibodyMeta: antibodyMetaSchema,
  primerMeta: primerMetaSchema,
});

export const confirmDraftItemSchema = z.object({
  draftId: z.string().min(1),
  editedPayload: confirmEditedPayloadSchema,
});

export type ConfirmEditedPayload = z.infer<typeof confirmEditedPayloadSchema>;
export type ConfirmDraftItem = z.infer<typeof confirmDraftItemSchema>;
export type ParsedExperimentTags = ExperimentTag[];
