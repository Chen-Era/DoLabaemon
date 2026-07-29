import { z } from "zod";
import { techniqueCategoryCodes } from "@/lib/experiment-techniques/data/blueprint";
import { reagentCapabilityTags } from "@/lib/rules/catalog";

export const techniqueStatusValues = ["DRAFT", "IN_REVIEW", "PUBLISHED", "DEPRECATED"] as const;
export const techniqueSourceValues = ["SYSTEM", "CURATED", "AI_DRAFT"] as const;
export const requirementKindValues = ["REAGENT", "CONSUMABLE", "INSTRUMENT", "SAMPLE", "CONTROL", "SOFTWARE"] as const;
export const requirementLevelValues = ["REQUIRED", "RECOMMENDED", "CONDITIONAL"] as const;
export const verificationModeValues = ["AUTO_INVENTORY", "MANUAL_CONFIRMATION"] as const;
export const evidenceTierValues = ["A1", "A2", "B1", "B2", "C1", "C2", "D"] as const;
export const hazardClassValues = [
  "BIOLOGICAL",
  "CHEMICAL",
  "IONIZING_RADIATION",
  "LASER_OPTICAL",
  "HIGH_VOLTAGE",
  "HIGH_PRESSURE",
  "CRYOGENIC",
  "ROTATING_EQUIPMENT",
  "SHARPS",
  "ANIMAL_WELFARE",
  "FIELD_ENVIRONMENT",
] as const;
export const evidenceSourceTypeValues = [
  "ONTOLOGY",
  "CONTROLLED_VOCABULARY",
  "REPORTING_STANDARD",
  "METHOD_PAPER",
  "VERSIONED_PROTOCOL",
  "SAFETY_GUIDANCE",
] as const;

const localizedLabelSchema = z.object({
  zh: z.string().trim().min(1),
  en: z.string().trim().min(1),
});

export const techniqueRequirementSchema = z.object({
  id: z.string().trim().min(1),
  kind: z.enum(requirementKindValues),
  level: z.enum(requirementLevelValues),
  verificationMode: z.enum(verificationModeValues),
  label: localizedLabelSchema,
  capabilityTags: z.array(z.enum(reagentCapabilityTags)).default([]),
  matcherValues: z.array(z.string().trim().min(1)).default([]),
  condition: localizedLabelSchema.optional(),
});

export const workflowStageSchema = z.object({
  key: z.string().trim().min(1),
  order: z.number().int().positive(),
  label: localizedLabelSchema,
  objective: localizedLabelSchema,
});

export const qcMetricSchema = z.object({
  id: z.string().trim().min(1),
  label: localizedLabelSchema,
  acceptance: localizedLabelSchema,
  evidenceSourceIds: z.array(z.string().trim().min(1)).min(1),
});

export const troubleshootingSchema = z.object({
  symptom: localizedLabelSchema,
  action: localizedLabelSchema,
});

export const safetyProfileSchema = z.object({
  biosafetyLevel: z.enum(["BSL1", "BSL2", "BSL3", "BSL4", "ABSL1", "ABSL2", "ABSL3", "ABSL4", "NA"]),
  riskLevel: z.enum(["LOW", "MODERATE", "HIGH", "RESTRICTED"]),
  hazardClasses: z.array(z.enum(hazardClassValues)).min(1),
  hazards: z.array(z.string().trim().min(1)),
  controls: z.array(localizedLabelSchema).min(1),
  waste: localizedLabelSchema,
  requiresLocalRiskAssessment: z.boolean(),
  evidenceSourceIds: z.array(z.string().trim().min(1)).min(1),
});

export const ontologyMappingSchema = z.object({
  scheme: z.enum(["OBI", "CHMO", "MESH", "NCIT", "BAO"]),
  termId: z.string().trim().min(1),
  termUri: z.string().url(),
  termLabel: z.string().trim().min(1),
  relation: z.enum(["EXACT", "BROAD", "NARROW", "RELATED"]),
  version: z.string().trim().min(1),
});

export const reportingStandardBindingSchema = z.object({
  standardId: z.string().trim().min(1),
  version: z.string().trim().min(1),
  applicability: localizedLabelSchema,
  requirementIds: z.array(z.string().trim().min(1)).min(1),
});

export const keyParameterSchema = z.object({
  id: z.string().trim().min(1),
  category: z.enum([
    "SAMPLE_INPUT",
    "REAGENT_IDENTITY",
    "INSTRUMENT_CONFIGURATION",
    "PROCESS_CONDITION",
    "ACQUISITION",
    "ANALYSIS",
    "CONTROL_RESULT",
  ]),
  label: localizedLabelSchema,
  recordingRule: localizedLabelSchema,
});

export const claimEvidenceSchema = z.object({
  claimId: z.string().trim().min(1),
  fieldPath: z.string().trim().min(1),
  statement: localizedLabelSchema,
  evidenceSourceId: z.string().trim().min(1),
  locator: z.string().trim().min(1),
  claimType: z.enum(["PRINCIPLE", "QUALITY", "SAFETY", "PERFORMANCE"]),
});

export const resolutionExampleSchema = z.object({
  query: z.string().trim().min(1),
  context: z.string().trim().min(1),
  expectedCode: z.string().trim().min(1).nullable(),
  excludedCode: z.string().trim().min(1).nullable(),
  reason: z.string().trim().min(1),
});

export const techniqueProfileSchema = z.object({
  code: z.string().trim().min(1),
  name: localizedLabelSchema,
  description: localizedLabelSchema,
  additionalRequirements: z.array(techniqueRequirementSchema),
});

export const experimentTechniqueSchema = z.object({
  id: z.string().trim().min(1),
  code: z.string().trim().regex(/^[A-Z][A-Z0-9_]*$/),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  revision: z.number().int().positive(),
  status: z.enum(techniqueStatusValues),
  source: z.enum(techniqueSourceValues),
  contentHash: z.string().trim().min(8),
  isAbstract: z.boolean(),
  parentCode: z.string().trim().min(1).nullable(),
  name: localizedLabelSchema,
  aliases: z.array(z.string().trim().min(1)).min(1),
  categoryCode: z.enum(techniqueCategoryCodes),
  subcategoryCode: z.string().trim().min(1),
  principle: localizedLabelSchema,
  scope: localizedLabelSchema,
  sampleTypes: z.array(z.string().trim().min(1)).min(1),
  inputTypes: z.array(z.string().trim().min(1)).min(1),
  outputTypes: z.array(z.string().trim().min(1)).min(1),
  readoutModes: z.array(z.string().trim().min(1)).min(1),
  throughput: z.enum(["LOW", "MEDIUM", "HIGH", "ULTRA_HIGH"]),
  destructive: z.boolean(),
  workflowStages: z.array(workflowStageSchema).min(2),
  keyParameters: z.array(keyParameterSchema).min(1),
  requirements: z.array(techniqueRequirementSchema),
  profiles: z.array(techniqueProfileSchema),
  qcMetrics: z.array(qcMetricSchema).min(1),
  limitations: z.object({
    zh: z.array(z.string().trim().min(1)).min(1),
    en: z.array(z.string().trim().min(1)).min(1),
  }),
  troubleshooting: z.array(troubleshootingSchema).min(1),
  safety: safetyProfileSchema,
  evidenceSourceIds: z.array(z.string().trim().min(1)).min(2),
  claimEvidence: z.array(claimEvidenceSchema).min(2),
  ontologyMappings: z.array(ontologyMappingSchema),
  ontologyUnmappedReason: localizedLabelSchema.nullable(),
  reportingStandards: z.array(reportingStandardBindingSchema),
  resolutionExamples: z.object({
    positive: z.array(resolutionExampleSchema).min(1),
    negative: z.array(resolutionExampleSchema).min(1),
  }),
  reviewedAt: z.string().datetime(),
  nextReviewDue: z.string().datetime(),
});

export const evidenceSourceSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  organization: z.string().trim().min(1),
  sourceType: z.enum(evidenceSourceTypeValues),
  tier: z.enum(evidenceTierValues),
  authorityScope: z.string().trim().min(1),
  canonicalUrl: z.string().url(),
  version: z.string().trim().min(1),
  versionUri: z.string().url(),
  releaseDate: z.string().trim().min(1),
  retrievedAt: z.string().datetime(),
  licenseId: z.string().trim().min(1),
  licenseUrl: z.string().url().nullable(),
  reuseMode: z.enum(["EMBED_WITH_ATTRIBUTION", "FACTS_AND_LINK_ONLY"]),
  doi: z.string().trim().min(1).nullable(),
  pmid: z.string().trim().min(1).nullable(),
});

export const techniqueDraftSchema = z.object({
  id: z.string().trim().min(1),
  labId: z.string().trim().min(1),
  createdById: z.string().trim().min(1),
  baseCode: z.string().trim().min(1).nullable(),
  baseRevision: z.number().int().positive().nullable(),
  status: z.enum(["DRAFT", "IN_REVIEW", "APPROVED", "REJECTED"]),
  payload: experimentTechniqueSchema.partial({
    id: true,
    contentHash: true,
    reviewedAt: true,
    nextReviewDue: true,
  }),
  reviewerId: z.string().trim().min(1).nullable(),
  reviewNote: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type LocalizedLabel = z.infer<typeof localizedLabelSchema>;
export type TechniqueRequirement = z.infer<typeof techniqueRequirementSchema>;
export type TechniqueProfile = z.infer<typeof techniqueProfileSchema>;
export type ExperimentTechnique = z.infer<typeof experimentTechniqueSchema>;
export type EvidenceSource = z.infer<typeof evidenceSourceSchema>;
export type TechniqueDraft = z.infer<typeof techniqueDraftSchema>;
export type RequirementKind = (typeof requirementKindValues)[number];
export type RequirementLevel = (typeof requirementLevelValues)[number];
export type VerificationMode = (typeof verificationModeValues)[number];

export type TechniqueSearchMatch = {
  technique: ExperimentTechnique;
  score: number;
  exact: boolean;
  evidence: string[];
};

export type TechniqueCheckStatus = "BLOCKED" | "NEEDS_CONFIRMATION" | "READY" | "UNSUPPORTED";

export type TechniqueCheckItem = {
  requirementId: string;
  label: string;
  kind: RequirementKind;
  level: RequirementLevel;
  verificationMode: VerificationMode;
  state: "MATCHED" | "MISSING" | "CONFIRMED" | "UNCONFIRMED" | "NOT_APPLICABLE";
  matchedName?: string;
};
