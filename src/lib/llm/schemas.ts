import { z } from "zod";
import { experimentTags } from "@/lib/rules/catalog";
import { antibodyMetaSchema, primerMetaSchema, reagentCategoryValues } from "@/lib/reagent-ingest/types";

export const reagentParsedSchema = z.object({
  category: z.enum(reagentCategoryValues),
  subCategory: z.string().nullable().optional(),
  vendor: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1),
  warnings: z.array(z.string()).default([]),
  experimentTags: z.array(z.enum(experimentTags)).default([]),
  antibodyMeta: antibodyMetaSchema,
  primerMeta: primerMetaSchema,
});

export const reagentVerificationSchema = z.object({
  status: z.enum(["verified", "unverified"]),
  method: z.enum(["native_web_search", "external_search", "none"]),
  reason: z.enum([
    "verified",
    "native_tool_unavailable",
    "native_search_no_sources",
    "external_search_unconfigured",
    "external_search_failed",
    "external_search_no_results",
    "verification_model_failed",
    "fallback_used",
  ]),
  warnings: z.array(z.string()).default([]),
});

export const verifiedReagentParsedSchema = reagentParsedSchema.extend({
  verification: reagentVerificationSchema,
});

export const reagentBatchExtractRowSchema = z.object({
  sourceText: z.string().min(1),
  name: z.string().min(1),
  vendor: z.string().nullable().optional(),
  catalogNo: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  antibodyCompatibilityText: z.string().nullable().optional(),
});

export const reagentBatchExtractSchema = z.array(reagentBatchExtractRowSchema);

export const experimentResolveSchema = z.object({
  proposedExperimentName: z.string().min(1),
  proposedExperimentCode: z.string().nullable().optional(),
  matchedExistingCode: z.string().nullable().optional(),
  workflowStages: z.array(z.string()).default([]),
  minRequiredItems: z
    .array(
      z.object({
        name: z.string().min(1),
        matcherType: z.enum(["TAG_ANY", "NAME_ANY", "ANTIBODY_TARGET_ANY", "PRIMER_TARGET_ANY", "PRIMER_REFERENCE"]),
        matcherValues: z.array(z.string()).default([]),
      }),
    )
    .default([]),
  recommendedItems: z
    .array(
      z.object({
        name: z.string().min(1),
        matcherType: z.enum(["TAG_ANY", "NAME_ANY", "ANTIBODY_TARGET_ANY", "PRIMER_TARGET_ANY", "PRIMER_REFERENCE"]),
        matcherValues: z.array(z.string()).default([]),
      }),
    )
    .default([]),
  warnings: z.array(z.string()).default([]),
  rationale: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1),
});
