import { normalizeTargetName, type ExperimentTag } from "@/lib/rules/catalog";
import { retrieveReagentKnowledge } from "@/lib/reagent-knowledge/retrieval";

export type ReagentCategory = "ANTIBODY" | "BUFFER" | "KIT" | "PRIMER" | "BIOLOGICAL" | "CHEMICAL" | "CONSUMABLE" | "OTHER";

export type ParsedAntibodyMeta = {
  role?: "PRIMARY" | "SECONDARY" | null;
  hostSpecies?: string | null;
  targetSpecies?: string | null;
  targetName?: string | null;
};

export type ParsedPrimerMeta = {
  targetName?: string | null;
  isReferenceGene?: boolean | null;
};

export type HeuristicParsedReagent = {
  category: ReagentCategory;
  subCategory?: string | null;
  vendor?: string | null;
  confidence: number;
  warnings: string[];
  experimentTags: ExperimentTag[];
  antibodyMeta?: ParsedAntibodyMeta | null;
  primerMeta?: ParsedPrimerMeta | null;
};

export type ReagentParseInput = {
  name: string;
  catalogNo?: string | null;
  note?: string | null;
};

export const standardSubCategories = [
  "Cell Culture Medium",
  "Serum Supplement",
  "Selection Antibiotic",
  "Transfection Reagent",
  "Gene Delivery Reagent",
  "Exosome Isolation Reagent",
  "Recombinant Protein",
  "Recombinant Cytokine",
  "Recombinant Growth Factor",
  "Cytokine",
  "Growth Factor",
  "Chemokine",
  "Ligand Protein",
  "Enzyme",
  "Nuclease",
  "Small Molecule Compound",
  "Pathway Inhibitor",
  "Agonist / Activator",
  "Expression Plasmid",
  "Lentiviral Vector",
  "Adenoviral Vector",
  "AAV Vector",
  "siRNA",
  "shRNA",
  "CRISPR Reagent",
  "Peptide",
  "Hormone",
  "Extracellular Matrix Coating",
] as const;

const referenceGeneTargets = ["GAPDH", "ACTB", "TUBULIN", "HPRT1", "18S", "RPLP0"] as const;

const speciesPatterns = [
  { pattern: /rabbit/, value: "Rabbit" },
  { pattern: /mouse/, value: "Mouse" },
  { pattern: /goat/, value: "Goat" },
  { pattern: /rat/, value: "Rat" },
] as const;

function buildSearchText(input: ReagentParseInput) {
  return [input.name, input.catalogNo, input.note].filter(Boolean).join(" | ");
}

function parseInput(input: string | ReagentParseInput): ReagentParseInput {
  return typeof input === "string" ? { name: input } : input;
}

function buildSignalSet(text: string) {
  const lowered = text.toLowerCase();
  return {
    hasRecombinant: /\b(recombinant|rec\.?)\b/.test(lowered),
    isProteinLike: /\b(protein|polypeptide|fusion protein|fc chimera|soluble)\b/.test(lowered),
    isLigandLike: /\b(ligand|rankl|trail|fasl|tnfsf\d+|wnt-?\d+|dll\d|jagged\d?)\b/.test(lowered),
    isChemokineLike: /\b(chemokine|cxcl\d+|ccl\d+|sdf-?1)\b/.test(lowered),
    isGrowthFactorLike: /\b(growth factor|egf|fgf|vegf|pdgf|bmp-?\d*|tgf-?\s?beta|tgfb\d*|igf-?\d*|hgf)\b/.test(lowered),
    isCytokineLike:
      /\b(interleukin|il-?\d+[a-z]*|tnf-?(alpha|beta)?|interferon|ifn-?[a-z0-9]+|gm-csf|m-csf|g-csf|csf|rankl|opg)\b/.test(lowered) ||
      /\b(chemokine|cxcl\d+|ccl\d+|sdf-?1)\b/.test(lowered),
    isEnzymeLike:
      /\b(enzyme|polymerase|ligase|phosphatase|kinase|recombinase|caspase|collagenase|dispase|hyaluronidase|trypsin|papain|pronase)\b/.test(
        lowered,
      ),
    isNucleaseLike: /\b(dnase|rnase|nuclease|restriction enzyme|endonuclease|exonuclease)\b/.test(lowered),
    isPathwayLike: /\b(pi3k|akt|mtor|mek|erk|jak|stat|smad|nf-?kb|rock|gsk3|ampk|vegfr|egfr|fgfr|mapk|p38|jnk|src)\b/.test(lowered),
    isInhibitorLike: /\b(inhibitor|blocker)\b/.test(lowered),
    isActivatorLike: /\b(agonist|activator|inducer)\b/.test(lowered),
    isPeptideLike: /\b(peptide|angiotensin|bradykinin)\b/.test(lowered),
    isHormoneLike: /\b(hormone|insulin|estrogen|estradiol|progesterone|aldosterone|thyroxine|triiodothyronine|growth hormone)\b/.test(lowered),
    isPlasmidLike: /\b(plasmid|vector|orf clone|expression clone|cdna clone|overexpression)\b/.test(lowered),
    isLentiviralLike: /\b(lentiviral|lentivirus|lenti-)\b/.test(lowered),
    isAdenoviralLike: /\b(adenoviral|adenovirus)\b/.test(lowered),
    isAavLike: /\b(aav|adeno-associated)\b/.test(lowered),
    isSiRnaLike: /\b(sirna|silencer|smartpool)\b/.test(lowered),
    isShRnaLike: /\b(shrna)\b/.test(lowered),
    isCrisprLike: /\b(crispr|cas9|cas12|sgrna|guide rna|grna)\b/.test(lowered),
    isExtracellularMatrixLike: /\b(matrigel|laminin|collagen\s*(i|ii|iii|iv|v)?|fibronectin|poly-l-lysine|poly-d-lysine|geltrex)\b/.test(lowered),
    isSmallMoleculeLike: /\b(small molecule|compound)\b/.test(lowered),
  };
}

const baseTagMatchers: Array<{ tag: ExperimentTag; pattern: RegExp }> = [
  { tag: "CELL_CULTURE_MEDIUM", pattern: /\b(dmem|rpmi|mem|imdm|ham'?s\s*f-?12|f12|medium|培养基)\b/ },
  { tag: "SERUM_SUPPLEMENT", pattern: /\b(fbs|fetal bovine serum|b27|n2 supplement|serum replacement|血清)\b/ },
  { tag: "ANTIBIOTIC_SUPPLEMENT", pattern: /\b(pen[\s-]*strep|penicillin[\s-]*streptomycin|gentamicin|amphotericin|antibiotic antimycotic)\b/ },
  { tag: "SELECTION_ANTIBIOTIC", pattern: /\b(puromycin|blasticidin|g418|geneticin|hygromycin|zeocin)\b/ },
  { tag: "CELL_DISSOCIATION_REAGENT", pattern: /\b(trypsin|trypLE|accutase|cell dissociation|胰酶)\b/i },
  { tag: "CELL_FREEZING_REAGENT", pattern: /\b(dmso|cryostor|freezing medium|冻存液)\b/i },
  { tag: "CELL_COUNTING_REAGENT", pattern: /\b(trypan blue|cck-8|cell counting kit|resazurin)\b/i },
  { tag: "MYCOPLASMA_TEST_REAGENT", pattern: /\b(mycoplasma|支原体)\b/ },
  { tag: "TRANSDUCTION_REAGENT", pattern: /\b(lentivirus|adenovirus|aav|viral transduction|polybrene)\b/ },
  {
    tag: "GENE_DELIVERY_REAGENT",
    pattern:
      /\b(lentivirus|adenovirus|aav|transfect|lipofectamine|lipo\s*3000|lipo3000|electroporation|gene delivery|plasmid|vector|sirna|shrna|sgrna|crispr|转染|转导)\b/,
  },
  { tag: "WB_LYSIS_BUFFER", pattern: /\b(ripa|lysis|裂解液)\b/ },
  { tag: "WB_LOADING_BUFFER", pattern: /\b(laemmli|loading buffer|sample buffer|lds)\b/ },
  { tag: "WB_BLOCKING_BUFFER", pattern: /\b(blocking buffer|non-fat milk|skim milk|脱脂奶粉)\b/ },
  { tag: "WB_WASH_BUFFER", pattern: /\b(tbst|pbst|wash buffer)\b/ },
  { tag: "WB_TRANSFER_REAGENT", pattern: /\b(transfer buffer|transfer reagent|转膜液)\b/ },
  { tag: "WB_TRANSFER_MEMBRANE", pattern: /\b(pvdf|nitrocellulose membrane|nc membrane|转印膜)\b/ },
  { tag: "WB_DETECTION_SUBSTRATE", pattern: /\b(ecl|chemiluminescent substrate|supersignal|luminal)\b/ },
  { tag: "PROTEASE_INHIBITOR", pattern: /\b(protease inhibitor|蛋白酶抑制剂)\b/ },
  { tag: "PHOSPHATASE_INHIBITOR", pattern: /\b(phosphatase inhibitor|磷酸酶抑制剂)\b/ },
  { tag: "PROTEIN_QUANTIFICATION_REAGENT", pattern: /\b(bca|bradford|protein assay|蛋白定量)\b/ },
  { tag: "REDUCING_AGENT", pattern: /\b(dtt|beta-mercaptoethanol|2-mercaptoethanol|tcep)\b/ },
  { tag: "GEL_STAIN", pattern: /\b(coomassie|ponceau|sypro|gel stain)\b/ },
  { tag: "DNA_EXTRACTION_REAGENT", pattern: /\b(dna extraction|genomic dna|dna isolation)\b/ },
  { tag: "RNA_EXTRACTION_REAGENT", pattern: /\b(trizol|rna extraction|rna isolation|rnaeasy|rna prep)\b/ },
  { tag: "PLASMID_PREP_REAGENT", pattern: /\b(plasmid prep|miniprep|maxiprep|endofree)\b/ },
  { tag: "PCR_MASTER_MIX", pattern: /\b(pcr master mix|taq mix|hot start taq|polymerase mix)\b/ },
  { tag: "REVERSE_TRANSCRIPTION_REAGENT", pattern: /\b(reverse transcription|cdna synthesis|rt kit|reverse transcriptase)\b/ },
  { tag: "QPCR_MASTER_MIX", pattern: /\b(sybr|taqman|qpcr master mix|real-time pcr mix)\b/ },
  { tag: "NUCLEASE_FREE_WATER", pattern: /\b(nuclease-free water|rnase-free water|dnase-free water|无核酸酶水)\b/ },
  { tag: "DNASE_REAGENT", pattern: /\b(dnase|ezdnase)\b/ },
  { tag: "RNASE_INHIBITOR", pattern: /\b(rnase inhibitor|rna inhibitor)\b/ },
  { tag: "TRANSFECTION_REAGENT", pattern: /\b(lipofectamine|lipo\s*3000|lipo3000|lipo\s*2000|lipo2000|jetprime|jetpei|fugene|transfect|转染)\b/ },
  { tag: "FIXATIVE", pattern: /\b(paraformaldehyde|pfa|methanol|acetone|fixative|固定液)\b/ },
  { tag: "PERMEABILIZATION_REAGENT", pattern: /\b(triton|saponin|permeabil|透化)\b/ },
  { tag: "BLOCKING_REAGENT", pattern: /\b(bsa|normal serum|goat serum|donkey serum|blocking|封闭液)\b/ },
  { tag: "NUCLEAR_STAIN", pattern: /\b(dapi|hoechst|draq7|核染)\b/ },
  { tag: "CYTOSKELETON_STAIN", pattern: /\b(phalloidin|rhodamine phalloidin|f-actin)\b/ },
  { tag: "ORGANELLE_STAIN", pattern: /\b(mitotracker|lysotracker|er-tracker|organelle stain)\b/ },
  { tag: "MOUNTING_MEDIUM", pattern: /\b(mounting medium|antifade|封片液)\b/ },
  { tag: "IF_WASH_BUFFER", pattern: /\b(pbs-t|pbst|tbs-t|if wash buffer)\b/ },
  { tag: "ELISA_COATING_REAGENT", pattern: /\b(coating buffer|elisa coating)\b/ },
  { tag: "ELISA_BLOCKING_REAGENT", pattern: /\b(elisa blocking|blocker|assay diluent)\b/ },
  { tag: "ELISA_WASH_BUFFER", pattern: /\b(elisa wash|wash concentrate)\b/ },
  { tag: "ELISA_SUBSTRATE", pattern: /\b(tmb|elisa substrate)\b/ },
  { tag: "FLOW_STAIN_BUFFER", pattern: /\b(facs buffer|flow staining buffer|stain buffer)\b/ },
  { tag: "FLOW_VIABILITY_DYE", pattern: /\b(7-aad|pi stain|propidium iodide|annexin v|viability dye)\b/ },
  { tag: "EXOSOME_ISOLATION_REAGENT", pattern: /\b(exosome isolation|ev isolation|extracellular vesicle isolation|exoquick)\b/ },
];

function uniq<T>(items: T[]) {
  return [...new Set(items)];
}

export function extractTargetName(name: string) {
  const lowered = name.toLowerCase();
  const antiMatch = lowered.match(/\banti[-\s]+([a-z0-9/+-]+)/);
  if (antiMatch?.[1]) return normalizeTargetName(antiMatch[1]);
  const antibodyMatch = lowered.match(/([a-z0-9/+-]+)\s+antibody/);
  if (antibodyMatch?.[1]) return normalizeTargetName(antibodyMatch[1]);
  const primerMatch = lowered.match(/([a-z0-9/+-]+)\s+(primer|probe)/);
  if (primerMatch?.[1]) return normalizeTargetName(primerMatch[1]);
  return null;
}

export function detectAntibodyMeta(name: string): ParsedAntibodyMeta | null {
  const lowered = name.toLowerCase();
  if (!/anti-|antibody|igg/.test(lowered)) return null;

  const isSecondary = /secondary|anti-rabbit|anti mouse|anti-mouse|anti goat|anti-goat|anti rat|anti-rat/.test(lowered);
  const hostSpecies = speciesPatterns.find((item) => item.pattern.test(lowered))?.value ?? null;
  const antiTargetSpeciesMatch = lowered.match(/anti[-\s]?(rabbit|mouse|goat|rat)/);

  return {
    role: isSecondary ? "SECONDARY" : "PRIMARY",
    hostSpecies,
    targetSpecies: isSecondary ? antiTargetSpeciesMatch?.[1] ?? null : null,
    targetName: isSecondary ? null : extractTargetName(name),
  };
}

export function detectPrimerMeta(name: string): ParsedPrimerMeta | null {
  const lowered = name.toLowerCase();
  if (!/primer|probe/.test(lowered)) return null;
  const targetName = extractTargetName(name);
  const normalizedTarget = normalizeTargetName(targetName);
  return {
    targetName,
    isReferenceGene: normalizedTarget ? referenceGeneTargets.includes(normalizedTarget as (typeof referenceGeneTargets)[number]) : false,
  };
}

export function detectExperimentTags(name: string, antibodyMeta: ParsedAntibodyMeta | null): ExperimentTag[] {
  const lowered = name.toLowerCase();
  const signals = buildSignalSet(name);
  const tags = baseTagMatchers.filter((matcher) => matcher.pattern.test(lowered)).map((matcher) => matcher.tag);

  if (
    signals.isGrowthFactorLike ||
    signals.isCytokineLike ||
    signals.isChemokineLike ||
    signals.isHormoneLike ||
    (signals.isLigandLike && signals.isProteinLike)
  ) {
    tags.push("CELL_STIMULATION_REAGENT");
  }

  if (
    signals.isLigandLike ||
    signals.isGrowthFactorLike ||
    signals.isCytokineLike ||
    (signals.isInhibitorLike && signals.isPathwayLike) ||
    signals.isActivatorLike
  ) {
    tags.push("SIGNALING_MODULATOR");
  }

  if (/\b(rankl|srankl|tnfsf11|m-?csf|csf1)\b/.test(lowered)) {
    tags.push("OSTEOCLAST_DIFFERENTIATION_REAGENT");
  }

  if (/\b(rankl|srankl|opg|osteoprotegerin|tnfrsf11b|bmp-?\d+|tgf-?\s?beta|tgfb\d*)\b/.test(lowered)) {
    tags.push("BONE_REMODELING_SIGNAL");
  }

  if (/\b(interleukin|il-?\d+[a-z]*|tnf-?(alpha|beta)?|interferon|ifn-?[a-z0-9]+|gm-csf|m-csf|g-csf|csf)\b/.test(lowered)) {
    tags.push("IMMUNE_CYTOKINE_REAGENT");
  }

  if (/\b(bmp-?\d+|bone morphogenetic protein|osteogenic|tgf-?\s?beta|tgfb\d*)\b/.test(lowered)) {
    tags.push("OSTEOGENIC_DIFFERENTIATION_REAGENT");
  }

  if (signals.isExtracellularMatrixLike) {
    tags.push("ECM_COATING_REAGENT");
  }

  if (/\b(matrigel|geltrex)\b/.test(lowered)) {
    tags.push("STEM_CELL_MATRIX");
  }

  if (antibodyMeta?.role === "PRIMARY") {
    tags.push("WB_PRIMARY_ANTIBODY", "IF_PRIMARY_ANTIBODY", "FLOW_PRIMARY_ANTIBODY");
  }

  if (antibodyMeta?.role === "SECONDARY") {
    if (/hrp/.test(lowered)) tags.push("WB_SECONDARY_ANTIBODY", "ELISA_DETECTION_ANTIBODY");
    if (/alexa|fitc|pe|apc|percp|cy3|cy5|fluor|fluorescent|488|555|594|647/.test(lowered)) {
      tags.push("IF_FLUORESCENT_SECONDARY_ANTIBODY", "FLOW_FLUORESCENT_ANTIBODY");
    }
  }

  if (/capture antibody|detection antibody|sandwich elisa/.test(lowered)) {
    tags.push("ELISA_DETECTION_ANTIBODY");
  }

  if (/primary antibody/.test(lowered) && /flow|facs/.test(lowered)) {
    tags.push("FLOW_PRIMARY_ANTIBODY");
  }

  if (/antibody/.test(lowered) && /flow|facs|cd\d+/.test(lowered) && /fitc|pe|apc|percp|bv\d+|fluor/.test(lowered)) {
    tags.push("FLOW_FLUORESCENT_ANTIBODY");
  }

  return uniq(tags);
}

export function detectCategory(name: string): ReagentCategory {
  const lowered = name.toLowerCase();
  const signals = buildSignalSet(name);
  const isGeneDelivery = /\b(lentivirus|adenovirus|aav|transfect|lipofectamine|lipo\s*3000|lipo3000|electroporation|转染|转导)\b/.test(lowered);
  if (/primer|probe/.test(lowered)) return "PRIMER";
  if (/anti-|antibody|igg/.test(lowered)) return "ANTIBODY";
  if (/kit|master mix|assay|panel/.test(lowered)) return "KIT";
  if (/buffer|medium|serum|pbs|tbs|tris|glycine|diluent/.test(lowered)) return "BUFFER";
  if (
    signals.hasRecombinant ||
    signals.isProteinLike ||
    signals.isLigandLike ||
    signals.isChemokineLike ||
    signals.isGrowthFactorLike ||
    signals.isCytokineLike ||
    signals.isEnzymeLike ||
    signals.isNucleaseLike ||
    signals.isPeptideLike ||
    signals.isHormoneLike ||
    signals.isPlasmidLike ||
    signals.isLentiviralLike ||
    signals.isAdenoviralLike ||
    signals.isAavLike ||
    signals.isSiRnaLike ||
    signals.isShRnaLike ||
    signals.isCrisprLike ||
    signals.isExtracellularMatrixLike
  ) {
    return "BIOLOGICAL";
  }
  if (/trizol|dnase|rnase|triton|dapi|paraformaldehyde|methanol|acetone|puromycin|blasticidin|g418|dmso/.test(lowered) || isGeneDelivery) return "CHEMICAL";
  if (/membrane|plate|slide|filter/.test(lowered)) return "CONSUMABLE";
  return "OTHER";
}

export function detectSubCategory(name: string, tags: ExperimentTag[], category?: ReagentCategory) {
  const signals = buildSignalSet(name);
  if (tags.includes("TRANSFECTION_REAGENT")) return "Transfection Reagent";
  if (tags.includes("CELL_CULTURE_MEDIUM")) return "Cell Culture Medium";
  if (tags.includes("SERUM_SUPPLEMENT")) return "Serum Supplement";
  if (tags.includes("SELECTION_ANTIBIOTIC")) return "Selection Antibiotic";
  if (tags.includes("EXOSOME_ISOLATION_REAGENT")) return "Exosome Isolation Reagent";
  if (signals.isLentiviralLike) return "Lentiviral Vector";
  if (signals.isAdenoviralLike) return "Adenoviral Vector";
  if (signals.isAavLike) return "AAV Vector";
  if (signals.isSiRnaLike) return "siRNA";
  if (signals.isShRnaLike) return "shRNA";
  if (signals.isCrisprLike) return "CRISPR Reagent";
  if (signals.isPlasmidLike) return "Expression Plasmid";
  if (signals.isExtracellularMatrixLike) return "Extracellular Matrix Coating";
  if (signals.hasRecombinant && signals.isGrowthFactorLike) return "Recombinant Growth Factor";
  if (signals.hasRecombinant && signals.isProteinLike) return "Recombinant Protein";
  if (signals.hasRecombinant && signals.isCytokineLike) return "Recombinant Cytokine";
  if (signals.isGrowthFactorLike) return "Growth Factor";
  if (signals.isChemokineLike) return "Chemokine";
  if (signals.isCytokineLike) return "Cytokine";
  if (signals.isLigandLike && category === "BIOLOGICAL") return "Ligand Protein";
  if (signals.isNucleaseLike) return "Nuclease";
  if (signals.isEnzymeLike) return "Enzyme";
  if (signals.isInhibitorLike && signals.isPathwayLike) return "Pathway Inhibitor";
  if (signals.isActivatorLike) return "Agonist / Activator";
  if (signals.isPeptideLike) return "Peptide";
  if (signals.isHormoneLike) return "Hormone";
  if (signals.isInhibitorLike && category === "CHEMICAL") return "Pathway Inhibitor";
  if (signals.isSmallMoleculeLike && category === "CHEMICAL") return "Small Molecule Compound";
  if (tags.includes("GENE_DELIVERY_REAGENT")) return "Gene Delivery Reagent";
  return null;
}

export function buildHeuristicParse(input: string | ReagentParseInput, warningPrefix = "Fallback parse for"): HeuristicParsedReagent {
  const parsedInput = parseInput(input);
  const searchText = buildSearchText(parsedInput);
  const retrieval = retrieveReagentKnowledge(parsedInput);
  const antibodyMeta = detectAntibodyMeta(parsedInput.name);
  const primerMeta = detectPrimerMeta(parsedInput.name);
  const retrievalTags = retrieval.candidateExperimentTags;
  const experimentTags = uniq([...retrievalTags, ...detectExperimentTags(searchText, antibodyMeta)]);
  const category = retrieval.candidateCategories[0] ?? detectCategory(searchText);
  const subCategory = retrieval.candidateSubCategories[0] ?? detectSubCategory(searchText, experimentTags, category);
  const confidenceBase = Math.max(retrieval.retrievalConfidence, 0);
  const confidence = retrieval.matchedEntries.length
    ? Math.max(0.86, confidenceBase)
    : experimentTags.length || antibodyMeta || primerMeta || subCategory
      ? 0.84
      : category !== "OTHER"
        ? 0.72
        : 0.4;
  return {
    category,
    subCategory,
    vendor: null,
    confidence,
    warnings: [`${warningPrefix} ${parsedInput.name}`],
    experimentTags,
    antibodyMeta,
    primerMeta,
  };
}
