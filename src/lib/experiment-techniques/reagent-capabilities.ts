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
  ["nucleic acid transfection lipid", tags("TRANSFECTION_REAGENT")],
  ["rna transfection reagent", tags("TRANSFECTION_REAGENT")],
  ["oligonucleotide delivery reagent", tags("TRANSFECTION_REAGENT")],
  ["recombinant aav vector", tags("GENE_DELIVERY_REAGENT", "TRANSDUCTION_REAGENT")],
  ["replication defective lentiviral vector", tags("GENE_DELIVERY_REAGENT", "TRANSDUCTION_REAGENT")],
  ["exosome isolation reagent", tags("EXOSOME_ISOLATION_REAGENT")],
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
