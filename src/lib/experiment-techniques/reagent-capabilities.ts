import type { ExperimentTag } from "@/lib/rules/catalog";

export type ResolvedTechniqueReagentCapability = {
  verificationMode: "AUTO_INVENTORY" | "MANUAL_CONFIRMATION";
  capabilityTags: ExperimentTag[];
  matcherValues: string[];
};

function normalize(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ");
}

function tags(...capabilityTags: ExperimentTag[]): ResolvedTechniqueReagentCapability {
  return {
    verificationMode: "AUTO_INVENTORY",
    capabilityTags,
    matcherValues: [],
  };
}

// The technique source contains deliberately precise, human-readable reagent
// descriptions. Only descriptions that can be classified reproducibly are
// auto-checked. The remaining descriptions stay visible as manual checks,
// rather than becoming unmatchable pseudo-tags that falsely block an assay.
const capabilityTagMappings = new Map<string, ResolvedTechniqueReagentCapability>([
  ["cell culture medium", tags("CELL_CULTURE_MEDIUM")],
  ["cell dissociation reagent", tags("CELL_DISSOCIATION_REAGENT")],
  ["cell cryoprotectant", tags("CELL_FREEZING_REAGENT")],
  ["serum free freezing medium", tags("CELL_FREEZING_REAGENT")],
  ["extracellular matrix coating", tags("ECM_COATING_REAGENT")],
  ["three dimensional matrix", tags("STEM_CELL_MATRIX")],
  ["defined stem cell matrix", tags("STEM_CELL_MATRIX")],
  ["density gradient medium", tags("DENSITY_GRADIENT_MEDIUM")],
  ["erythrocyte lysis buffer", tags("ERYTHROCYTE_LYSIS_BUFFER")],
  ["tissue dissociation enzyme", tags("TISSUE_DISSOCIATION_ENZYME")],
  ["dnase nuclease", tags("DNASE_REAGENT")],
  ["rnase free dnase", tags("DNASE_REAGENT")],
  ["rnase inhibitor", tags("RNASE_INHIBITOR")],
  ["protein lysis buffer", tags("WB_LYSIS_BUFFER")],
  ["protein transfer membrane", tags("WB_TRANSFER_MEMBRANE")],
  ["protein molecular weight marker", tags("WB_PROTEIN_MARKER")],
  ["sds protein sample buffer", tags("WB_LOADING_BUFFER")],
  ["primary antibody", tags("WB_PRIMARY_ANTIBODY")],
  ["labeled secondary antibody", tags("WB_SECONDARY_ANTIBODY")],
  ["enzyme conjugated anti species antibody", tags("ELISA_DETECTION_ANTIBODY")],
  ["detection antibody", tags("ELISA_DETECTION_ANTIBODY")],
  ["capture antibody", tags("ELISA_CAPTURE_ANTIBODY")],
  ["elisa substrate", tags("ELISA_SUBSTRATE")],
  ["elisa standard", tags("ELISA_STANDARD")],
  ["flow cytometry antibody panel", tags("FLOW_ANTIBODY_PANEL")],
  ["sorting validated antibody panel", tags("FLOW_ANTIBODY_PANEL")],
  ["viability dye", tags("FLOW_VIABILITY_DYE")],
  ["reverse transcriptase", tags("REVERSE_TRANSCRIPTION_REAGENT")],
  ["reverse transcription primers", tags("PCR_PRIMER_SET")],
  ["qpcr amplification chemistry", tags("QPCR_MASTER_MIX")],
  ["qpcr primers", tags("PCR_PRIMER_SET")],
  ["target specific qpcr primer set", tags("PCR_PRIMER_SET")],
  ["target specific pcr primer set", tags("PCR_PRIMER_SET")],
  ["intercalating dye qpcr chemistry", tags("QPCR_MASTER_MIX")],
  ["one step rt qpcr chemistry", tags("QPCR_MASTER_MIX")],
  ["cdna synthesis kit", tags("REVERSE_TRANSCRIPTION_REAGENT")],
  ["qpcr hydrolysis probe", tags("QPCR_PROBE")],
  ["dna polymerase", tags("DNA_POLYMERASE")],
  ["thermostable dna polymerase", tags("DNA_POLYMERASE")],
  ["hot start dna polymerase", tags("DNA_POLYMERASE")],
  ["proofreading dna polymerase", tags("DNA_POLYMERASE")],
  ["high fidelity dna polymerase", tags("DNA_POLYMERASE")],
  ["pcr primers", tags("PCR_PRIMER_SET")],
  ["dntp mix", tags("DNTP_MIX")],
  ["pcr amplification chemistry", tags("PCR_MASTER_MIX")],
  ["multiplex pcr master mix", tags("PCR_MASTER_MIX")],
  ["digital pcr master mix", tags("PCR_MASTER_MIX")],
  ["droplet digital pcr master mix", tags("PCR_MASTER_MIX")],
  ["dna ligase", tags("DNA_LIGASE")],
  ["t4 dna ligase", tags("DNA_LIGASE")],
  ["restriction endonuclease", tags("RESTRICTION_ENDONUCLEASE")],
  ["type iis restriction enzyme", tags("RESTRICTION_ENDONUCLEASE")],
  ["dna binding magnetic beads", tags("DNA_BINDING_MAGNETIC_BEADS")],
  ["chip grade antibody", tags("CHIP_GRADE_ANTIBODY")],
  ["protein a g magnetic beads", tags("PROTEIN_A_G_MAGNETIC_BEADS")],
  ["tn5 transposase", tags("TRANSPOSASE_REAGENT")],
  ["nuclei isolation reagent", tags("NUCLEI_ISOLATION_REAGENT")],
  ["single cell barcoding reagent", tags("SINGLE_CELL_BARCODING_REAGENT")],
  ["oligonucleotide barcoded antibody panel", tags("OLIGO_BARCODED_ANTIBODY_PANEL")],
  ["spatial probe panel", tags("SPATIAL_PROBE_PANEL")],
  ["crispr guide rna library", tags("CRISPR_GUIDE_LIBRARY")],
  ["target enrichment probe", tags("TARGET_ENRICHMENT_PROBE")],
  ["bisulfite conversion reagent", tags("BISULFITE_CONVERSION_REAGENT")],
  ["metabolite extraction reagent", tags("METABOLITE_EXTRACTION_REAGENT")],
  ["host dna depletion reagent", tags("HOST_DNA_DEPLETION_REAGENT")],
  ["rrna depletion reagent", tags("RRNA_DEPLETION_REAGENT")],
  ["phosphopeptide enrichment reagent", tags("PHOSPHOPEPTIDE_ENRICHMENT_REAGENT")],
  ["stable isotope tracer", tags("STABLE_ISOTOPE_TRACER")],
  ["nucleic acid transfection lipid", tags("TRANSFECTION_REAGENT")],
  ["rna transfection reagent", tags("TRANSFECTION_REAGENT")],
  ["oligonucleotide delivery reagent", tags("TRANSFECTION_REAGENT")],
  ["recombinant aav vector", tags("GENE_DELIVERY_REAGENT", "TRANSDUCTION_REAGENT")],
  ["replication defective lentiviral vector", tags("GENE_DELIVERY_REAGENT", "TRANSDUCTION_REAGENT")],
  ["gene delivery reagent", tags("GENE_DELIVERY_REAGENT")],
  ["library preparation reagent", tags("LIBRARY_PREPARATION_REAGENT")],
  ["sequencing run reagent", tags("SEQUENCING_RUN_REAGENT")],
  ["omics labeling reagent", tags("OMICS_LABELING_REAGENT")],
  ["internal standard", tags("INTERNAL_STANDARD")],
  ["calibration standard", tags("CALIBRATION_STANDARD")],
  ["solvent reagent", tags("SOLVENT_REAGENT")],
  ["exosome isolation reagent", tags("EXOSOME_ISOLATION_REAGENT")],
  ["exosome depleted serum", tags("EXOSOME_DEPLETED_SERUM")],
  ["extracellular vesicle immunocapture reagent", tags("EXOSOME_CAPTURE_REAGENT")],
  ["autophagy inducer", tags("AUTOPHAGY_INDUCER")],
  ["autophagy flux inhibitor", tags("AUTOPHAGY_FLUX_INHIBITOR")],
  ["extracellular matrix degradation assay reagent", tags("ECM_DEGRADATION_ASSAY_REAGENT")],
  ["extracellular matrix remodeling modulator", tags("ECM_REMODELING_MODULATOR")],
  ["mitochondrial stain", tags("MITOCHONDRIAL_STAIN")],
  ["mitochondrial membrane potential dye", tags("MITOCHONDRIAL_MEMBRANE_POTENTIAL_DYE")],
  ["mitochondrial superoxide dye", tags("MITOCHONDRIAL_SUPEROXIDE_DYE")],
  ["mitochondrial respiration assay reagent", tags("MITOCHONDRIAL_RESPIRATION_ASSAY_REAGENT")],
  ["mitochondrial stressor", tags("MITOCHONDRIAL_STRESSOR")],
  ["type i interferon reagent", tags("TYPE_I_INTERFERON_REAGENT")],
  ["type ii interferon reagent", tags("TYPE_II_INTERFERON_REAGENT")],
  ["interferon pathway modulator", tags("INTERFERON_PATHWAY_MODULATOR")],
  ["innate immune stimulant", tags("INNATE_IMMUNE_STIMULANT")],
  ["inflammasome activator", tags("INFLAMMASOME_ACTIVATOR")],
  ["t cell activation reagent", tags("T_CELL_ACTIVATION_REAGENT")],
  ["t cell lineage marker reagent", tags("T_CELL_LINEAGE_MARKER_REAGENT")],
  ["b cell activation reagent", tags("B_CELL_ACTIVATION_REAGENT")],
  ["b cell lineage marker reagent", tags("B_CELL_LINEAGE_MARKER_REAGENT")],
  ["nk cell activation reagent", tags("NK_CELL_ACTIVATION_REAGENT")],
  ["nk cell marker reagent", tags("NK_CELL_MARKER_REAGENT")],
  ["myeloid polarization reagent", tags("MYELOID_POLARIZATION_REAGENT")],
  ["myeloid lineage marker reagent", tags("MYELOID_LINEAGE_MARKER_REAGENT")],
  ["immune checkpoint reagent", tags("IMMUNE_CHECKPOINT_REAGENT")],
  ["immune metabolism modulator", tags("IMMUNE_METABOLISM_MODULATOR")],
  ["antigen presentation reagent", tags("ANTIGEN_PRESENTATION_REAGENT")],
  ["complement or fc effector reagent", tags("COMPLEMENT_FC_EFFECTOR_REAGENT")],
  ["immune chemotaxis reagent", tags("IMMUNE_CHEMOTAXIS_REAGENT")],
  ["fc receptor blocking reagent", tags("FC_RECEPTOR_BLOCKING_REAGENT")],
  ["immune cell enrichment reagent", tags("IMMUNE_CELL_ENRICHMENT_REAGENT")],
]);

export function resolveTechniqueReagentCapability(capability: string): ResolvedTechniqueReagentCapability {
  const resolved = capabilityTagMappings.get(normalize(capability));
  if (resolved) return resolved;
  return {
    verificationMode: "MANUAL_CONFIRMATION",
    capabilityTags: [],
    matcherValues: [capability],
  };
}
