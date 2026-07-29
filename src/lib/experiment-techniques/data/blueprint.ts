export const techniqueCategoryCodes = [
  "SAMPLE_MODELS",
  "NUCLEIC_ACID_GENETIC_ENGINEERING",
  "PROTEIN_IMMUNOASSAYS",
  "IMAGING_HISTOLOGY",
  "CYTOMETRY_SORTING",
  "CELL_FUNCTION",
  "MICROBIOLOGY_INFECTION",
  "ANALYTICAL_BIOPHYSICS",
  "SEQUENCING_OMICS",
  "STRUCTURAL_BIOLOGY",
  "ANIMAL_IN_VIVO",
  "ECOLOGY_FIELD",
] as const;

export type TechniqueCategoryCode = (typeof techniqueCategoryCodes)[number];

export const techniquePresetCodes = [
  "SAMPLE_PREPARATION",
  "CELL_CULTURE",
  "TISSUE_MODEL",
  "NUCLEIC_ACID_EXTRACTION",
  "PCR_AMPLIFICATION",
  "MOLECULAR_CLONING",
  "GENE_DELIVERY",
  "GENE_EDITING",
  "NUCLEIC_ACID_HYBRIDIZATION",
  "PROTEIN_ANALYSIS",
  "IMMUNOASSAY",
  "PROTEIN_PURIFICATION",
  "MICROSCOPY",
  "HISTOLOGY",
  "FLOW_CYTOMETRY",
  "CELL_BASED_ASSAY",
  "MICROBIAL_CULTURE",
  "INFECTION_ASSAY",
  "SPECTROSCOPY",
  "CHROMATOGRAPHY",
  "MASS_SPECTROMETRY",
  "BIOPHYSICAL_MEASUREMENT",
  "SEQUENCING",
  "OMICS_SAMPLE_PREP",
  "STRUCTURAL_ANALYSIS",
  "ANIMAL_PROCEDURE",
  "FIELD_SAMPLING",
] as const;

export type TechniquePresetCode = (typeof techniquePresetCodes)[number];

export type TechniqueBlueprint = {
  code: string;
  slug: string;
  nameZh: string;
  nameEn: string;
  aliases: string[];
  categoryCode: TechniqueCategoryCode;
  subcategoryCode: string;
  preset: TechniquePresetCode;
  principleZh: string;
  principleEn: string;
  scopeZh: string;
  scopeEn: string;
  sampleTypes: string[];
  readoutModes: string[];
  evidenceSourceIds: string[];
  reportingStandardIds?: string[];
  reagentCapabilities?: string[];
  omitBaselineReagentKeys?: string[];
  hazards?: string[];
  biosafetyLevel?: "BSL1" | "BSL2" | "BSL3" | "BSL4" | "ABSL1" | "ABSL2" | "ABSL3" | "ABSL4" | "NA";
  destructive?: boolean;
  throughput?: "LOW" | "MEDIUM" | "HIGH" | "ULTRA_HIGH";
  ontologyMappings?: Array<{
    scheme: "OBI" | "CHMO" | "MESH" | "NCIT" | "BAO";
    termId: string;
    termUri: string;
    termLabel: string;
    relation: "EXACT" | "BROAD" | "NARROW" | "RELATED";
    version: string;
  }>;
  workflowOverrides?: Array<{ labelZh: string; labelEn: string }>;
  instrumentOverride?: { labelZh: string; labelEn: string };
  requiredControlOverrides?: Array<{ labelZh: string; labelEn: string }>;
  qcOverrides?: Array<{ labelZh: string; labelEn: string }>;
  limitationsZh?: string[];
  limitationsEn?: string[];
};
