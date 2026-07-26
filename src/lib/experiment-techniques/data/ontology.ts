import type {
  TechniqueBlueprint,
  TechniquePresetCode,
} from "./blueprint";

/**
 * Manually verified OBI/CHMO/MeSH term mappings for technique blueprints.
 *
 * Every identifier below was verified live on 2026-07-26 against OLS4
 * (https://www.ebi.ac.uk/ols4/api/search) and the NLM MeSH descriptor lookup
 * API (https://id.nlm.nih.gov/mesh/lookup/descriptor). The registry of
 * verified terms lives in docs/experiment-knowledge/ontology-map.json; do not
 * add identifiers here that are not recorded there.
 */

export type OntologyMapping = NonNullable<
  TechniqueBlueprint["ontologyMappings"]
>[number];

type VerifiedScheme = "OBI" | "CHMO" | "MESH";

type OntologyRelation = OntologyMapping["relation"];

// Version strings mirror sources.ts (OBI_2025 / CHMO_2025 / MESH_2026).
const versionByScheme: Record<VerifiedScheme, string> = {
  OBI: "2025 release series",
  CHMO: "2025 release series",
  MESH: "2026",
};

function termUri(scheme: VerifiedScheme, termId: string): string {
  if (scheme === "MESH") {
    return `http://id.nlm.nih.gov/mesh/${termId}`;
  }
  return `http://purl.obolibrary.org/obo/${scheme}_${termId.split(":")[1]}`;
}

function createMapping(
  scheme: VerifiedScheme,
  termId: string,
  termLabel: string,
  relation: OntologyRelation,
): OntologyMapping {
  return {
    scheme,
    termId,
    termUri: termUri(scheme, termId),
    termLabel,
    relation,
    version: versionByScheme[scheme],
  };
}

export const obiMapping = (
  termId: string,
  termLabel: string,
  relation: OntologyRelation = "EXACT",
) => createMapping("OBI", termId, termLabel, relation);

export const chmoMapping = (
  termId: string,
  termLabel: string,
  relation: OntologyRelation = "EXACT",
) => createMapping("CHMO", termId, termLabel, relation);

export const meshMapping = (
  termId: string,
  termLabel: string,
  relation: OntologyRelation = "EXACT",
) => createMapping("MESH", termId, termLabel, relation);

/**
 * Prepends technique-level mappings to preset defaults, dropping later
 * duplicates of the same scheme+termId so an EXACT override wins over a
 * broader preset-level entry for the same term.
 */
export function combineOntologyMappings(
  primary: OntologyMapping[],
  defaults: OntologyMapping[],
): OntologyMapping[] {
  const seen = new Set(primary.map((item) => `${item.scheme}:${item.termId}`));
  return [
    ...primary,
    ...defaults.filter((item) => !seen.has(`${item.scheme}:${item.termId}`)),
  ];
}

/**
 * Default mappings per preset, transcribed from the "presets" section of
 * docs/experiment-knowledge/ontology-map.json (all IDs verified 2026-07-26).
 */
export const presetOntologyMappings: Record<
  TechniquePresetCode,
  OntologyMapping[]
> = {
  SAMPLE_PREPARATION: [
    obiMapping("OBI:0000073", "sample preparation for assay", "BROAD"),
    meshMapping("D013048", "Specimen Handling", "RELATED"),
  ],
  CELL_CULTURE: [
    obiMapping("OBI:0001876", "cell culture"),
    meshMapping("D018929", "Cell Culture Techniques", "RELATED"),
  ],
  TISSUE_MODEL: [
    meshMapping("D046509", "Tissue Culture Techniques", "BROAD"),
    meshMapping("D009940", "Organoids", "RELATED"),
  ],
  NUCLEIC_ACID_EXTRACTION: [
    obiMapping("OBI:0666667", "nucleic acid extraction"),
  ],
  PCR_AMPLIFICATION: [
    obiMapping("OBI:0000415", "polymerase chain reaction"),
    meshMapping("D016133", "Polymerase Chain Reaction"),
  ],
  MOLECULAR_CLONING: [
    meshMapping("D003001", "Cloning, Molecular"),
    obiMapping("OBI:0000738", "restriction enzyme based cloning", "RELATED"),
  ],
  GENE_DELIVERY: [
    obiMapping("OBI:0001152", "transfection", "BROAD"),
    meshMapping("D014162", "Transfection", "RELATED"),
  ],
  GENE_EDITING: [meshMapping("D000072669", "Gene Editing")],
  NUCLEIC_ACID_HYBRIDIZATION: [
    obiMapping("OBI:0302903", "nucleic acid hybridization"),
    meshMapping("D009693", "Nucleic Acid Hybridization"),
  ],
  PROTEIN_ANALYSIS: [
    obiMapping("OBI:0000854", "western blot assay", "RELATED"),
    meshMapping("D004591", "Electrophoresis, Polyacrylamide Gel", "RELATED"),
    meshMapping("D015153", "Blotting, Western", "RELATED"),
  ],
  IMMUNOASSAY: [
    meshMapping("D007118", "Immunoassay"),
    obiMapping("OBI:0000661", "enzyme-linked immunosorbent assay", "RELATED"),
    meshMapping("D004797", "Enzyme-Linked Immunosorbent Assay", "RELATED"),
  ],
  PROTEIN_PURIFICATION: [
    chmoMapping("CHMO:0001006", "affinity chromatography", "RELATED"),
    chmoMapping("CHMO:0001000", "chromatography", "BROAD"),
    meshMapping("D002846", "Chromatography, Affinity", "RELATED"),
  ],
  MICROSCOPY: [
    chmoMapping("CHMO:0000067", "microscopy"),
    meshMapping("D008853", "Microscopy"),
  ],
  HISTOLOGY: [
    meshMapping("D006652", "Histological Techniques", "BROAD"),
    obiMapping("OBI:0001986", "immunohistochemistry", "RELATED"),
    meshMapping("D007150", "Immunohistochemistry", "RELATED"),
  ],
  FLOW_CYTOMETRY: [
    obiMapping("OBI:0000916", "flow cytometry assay"),
    meshMapping("D005434", "Flow Cytometry"),
  ],
  CELL_BASED_ASSAY: [
    obiMapping("OBI:0003583", "cell viability assay", "RELATED"),
    meshMapping("D001681", "Biological Assay", "BROAD"),
  ],
  MICROBIAL_CULTURE: [
    meshMapping("D008828", "Microbiological Techniques", "BROAD"),
    meshMapping("D003470", "Culture Media", "RELATED"),
    meshMapping("D008826", "Microbial Sensitivity Tests", "RELATED"),
  ],
  INFECTION_ASSAY: [
    obiMapping("OBI:0001187", "infectious agent detection assay", "BROAD"),
    meshMapping("D008826", "Microbial Sensitivity Tests", "RELATED"),
  ],
  SPECTROSCOPY: [
    chmoMapping("CHMO:0000228", "spectroscopy"),
    meshMapping("D013057", "Spectrum Analysis"),
  ],
  CHROMATOGRAPHY: [
    chmoMapping("CHMO:0001000", "chromatography"),
    meshMapping("D002845", "Chromatography"),
  ],
  MASS_SPECTROMETRY: [
    chmoMapping("CHMO:0000470", "mass spectrometry"),
    meshMapping("D013058", "Mass Spectrometry"),
  ],
  BIOPHYSICAL_MEASUREMENT: [
    chmoMapping(
      "CHMO:0000624",
      "surface plasmon resonance spectroscopy",
      "RELATED",
    ),
    meshMapping("D020349", "Surface Plasmon Resonance", "RELATED"),
    chmoMapping("CHMO:0000323", "circular dichroism spectroscopy", "RELATED"),
  ],
  SEQUENCING: [
    obiMapping("OBI:0600047", "sequencing assay"),
    meshMapping("D017422", "Sequence Analysis, DNA", "RELATED"),
  ],
  OMICS_SAMPLE_PREP: [
    obiMapping("OBI:0000073", "sample preparation for assay", "BROAD"),
    meshMapping("D023281", "Genomics", "RELATED"),
    meshMapping("D040901", "Proteomics", "RELATED"),
  ],
  STRUCTURAL_ANALYSIS: [
    meshMapping("D018360", "Crystallography, X-Ray", "RELATED"),
    chmoMapping(
      "CHMO:0000591",
      "nuclear magnetic resonance spectroscopy",
      "RELATED",
    ),
    meshMapping("D020285", "Cryoelectron Microscopy", "RELATED"),
  ],
  ANIMAL_PROCEDURE: [
    meshMapping("D032761", "Animal Experimentation", "BROAD"),
  ],
  FIELD_SAMPLING: [
    meshMapping("D004784", "Environmental Monitoring", "BROAD"),
  ],
};

/**
 * Fills in preset-level ontology mappings for blueprints that do not declare
 * their own; explicit blueprint-level mappings always win.
 */
export function withPresetOntology(
  blueprints: TechniqueBlueprint[],
): TechniqueBlueprint[] {
  return blueprints.map((blueprint) =>
    blueprint.ontologyMappings?.length
      ? blueprint
      : {
          ...blueprint,
          ontologyMappings: presetOntologyMappings[blueprint.preset].map(
            (item) => ({ ...item }),
          ),
        },
  );
}
