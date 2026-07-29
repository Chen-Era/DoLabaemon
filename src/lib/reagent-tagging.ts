import { normalizeTargetName, type ExperimentTag } from "@/lib/rules/catalog";
import { retrieveReagentKnowledge } from "@/lib/reagent-knowledge/retrieval";
import { supplementReagentCapabilityTags } from "@/lib/reagent-capability-bundles";

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
  "Protein Molecular Weight Marker",
  "Cell Stain",
  "Cell Culture Vessel",
  "Syringe",
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

const antibodySpecies = ["rabbit", "mouse", "goat", "rat", "donkey", "chicken", "human", "sheep", "hamster", "horse"] as const;

const speciesPatterns = antibodySpecies.map((species) => ({
  pattern: new RegExp(`\\b${species}\\b`),
  value: species.slice(0, 1).toUpperCase() + species.slice(1),
}));

const antibodySignalPattern = /\b(anti[-–—\s]+|antibody|immunoglobulin|igg(?:\d+)?|igm|iga|mab|pab|monoclonal|polyclonal)\b|抗体|单克隆|多克隆/i;
const secondaryAntibodyPattern = /\bsecondary\s+antibody\b|二抗|抗二抗/i;
const isotypeControlPattern = /\b(isotype\s+control|igg\d*\s+control|normal\s+(?:rabbit|mouse|goat|rat|donkey|chicken|human)\s+igg)\b|同型对照/i;
const elisaAntibodyPattern = /\b(capture|detection)\s+antibody\b|(?:捕获|检测)抗体|sandwich\s+elisa/i;
const antibodyConjugatePattern = /\b(conjugated?|labelled?|labeled|biotinylated|alexa(?:\s+fluor)?|fitc|pe|apc|percp|cy3|cy5|bv\d+|hrp|fluorophore)\b/i;
const antibodyPrimaryTagSet = new Set<ExperimentTag>(["WB_PRIMARY_ANTIBODY", "IF_PRIMARY_ANTIBODY", "FLOW_PRIMARY_ANTIBODY"]);

function formatSpecies(species?: string | null) {
  return species ? species.slice(0, 1).toUpperCase() + species.slice(1).toLowerCase() : null;
}

function isSecondaryAntibodyName(lowered: string) {
  if (secondaryAntibodyPattern.test(lowered)) return true;
  const species = antibodySpecies.join("|");
  return new RegExp(`\\banti[-–—\\s]?(${species})\\s+(?:igg(?:\\d+)?|igm|iga|igy|immunoglobulin)\\b`, "i").test(lowered);
}

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
  // Do not match the word "medium" on its own: it incorrectly labels
  // mounting/freezing media and unrelated solutions as culture medium.
  {
    tag: "CELL_CULTURE_MEDIUM",
    pattern:
      /\b(?:dmem|rpmi(?:[-\s]?1640)?|imdm|(?:alpha|α)[-\s]?mem|mem|ham'?s\s*f-?12|f-?12|minimum essential medium|(?:cell|tissue) culture medium)\b|(?:细胞|组织)?培养基/i,
  },
  { tag: "SERUM_SUPPLEMENT", pattern: /\b(fbs|fetal bovine serum|b27|n2 supplement|serum replacement|血清)\b/ },
  { tag: "ANTIBIOTIC_SUPPLEMENT", pattern: /\b(pen[\s-]*strep|penicillin[\s-]*streptomycin|gentamicin|amphotericin|antibiotic antimycotic)\b/ },
  { tag: "SELECTION_ANTIBIOTIC", pattern: /\b(puromycin|blasticidin|g418|geneticin|hygromycin|zeocin)\b/ },
  { tag: "CELL_DISSOCIATION_REAGENT", pattern: /\b(trypsin|trypLE|accutase|cell dissociation|胰酶)\b/i },
  { tag: "CELL_FREEZING_REAGENT", pattern: /\b(dmso|cryostor|freezing medium|冻存液)\b/i },
  { tag: "CELL_COUNTING_REAGENT", pattern: /\b(trypan blue|cck-8|cell counting kit|resazurin)\b/i },
  { tag: "CELL_VIABILITY_ASSAY_REAGENT", pattern: /\b(?:mtt|xtt|wst-?1|wst-?8|resazurin|alamarblue|celltiter|atp luminescen(?:ce|t)|ldh(?:\s+release)?)\b|细胞(?:活力|毒性)检测试剂/i },
  { tag: "CELL_STAIN_REAGENT", pattern: /\b(cell stain(?:ing)?|staining solution|fluorescent dye|calcein|ethidium homodimer|crystal violet|neutral red)\b|细胞染色|染色液|荧光染料/i },
  { tag: "CELL_CULTURE_VESSEL", pattern: /\b(?:cell|tissue)\s+culture\b[\s\w-]{0,40}\b(?:dish|plate|flask|bottle|well)\b|\bculture\s*(?:dish|plate|flask|bottle)\b|培养(?:皿|板|瓶|孔板|器皿)|细胞培养(?:皿|板|瓶)/i },
  { tag: "SYRINGE_CONSUMABLE", pattern: /\b(?:syringe|luer[-\s]?lock|syringe needle)\b|注射器/i },
  {
    tag: "ANESTHETIC_REAGENT",
    pattern:
      /\bavertin\b|阿(?:佛|弗)丁|(?=[\s\S]*(?:(?:2,2,2[-\s]?)?tribromoethanol|三溴乙醇))(?=[\s\S]*(?:anesth|anaesth|麻醉|即用型|ready[-\s]?to[-\s]?use|working solution))/i,
  },
  { tag: "SOLVENT_REAGENT", pattern: /\b(?:ethanol|ethyl alcohol|absolute alcohol)\b|乙醇|酒精/i },
  { tag: "DISINFECTION_REAGENT", pattern: /\b(?:70|75)\s*%\s*(?:ethanol|alcohol)\b|(?:70|75)\s*(?:%|％|度)\s*(?:乙醇|酒精)|(?:消毒(?:液|剂)?|disinfectant)/i },
  { tag: "MYCOPLASMA_TEST_REAGENT", pattern: /\b(mycoplasma|支原体)\b/ },
  { tag: "ANTICOAGULANT_REAGENT", pattern: /\b(?:edta|heparin|sodium citrate|citrate tube|anticoagulant)\b|抗凝剂|枸橼酸钠/i },
  { tag: "SAMPLE_PRESERVATION_REAGENT", pattern: /\b(?:rnalater|sample preservation|preservation medium|stabilization reagent)\b|样本保存(?:液|试剂)|稳定化试剂/i },
  { tag: "DENSITY_GRADIENT_MEDIUM", pattern: /\b(ficoll(?:-paque)?|lymphoprep|histopaque|density gradient medium)\b|密度梯度(?:分离)?液/i },
  { tag: "ERYTHROCYTE_LYSIS_BUFFER", pattern: /\b(?:rbc|red blood cell|erythrocyte)[\s-]*lysis(?:\s+buffer)?\b|\back\s+lysis\b|红细胞裂解液/i },
  { tag: "TISSUE_DISSOCIATION_ENZYME", pattern: /\b(collagenase|dispase|papain|pronase|tissue dissociation enzyme)\b|组织(?:消化|酶解)酶/i },
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
  {
    tag: "WB_PROTEIN_MARKER",
    pattern:
      /\b(?:pre[-\s]?stained|tri[-\s]?color|three[-\s]?color|multicolor|color|colour)\s+(?:protein\s+)?(?:marker|ladder|standard)\b|\bprotein\s+(?:marker|ladder|molecular weight standard)\b|(?:三色|彩色|预染)(?:蛋白)?(?:marker|标记|分子量标准)|蛋白(?:质)?(?:marker|梯|分子量标准)/i,
  },
  { tag: "WB_DETECTION_SUBSTRATE", pattern: /\b(ecl|chemiluminescent substrate|supersignal|luminal)\b/ },
  { tag: "PROTEASE_INHIBITOR", pattern: /\b(protease inhibitor|蛋白酶抑制剂)\b/ },
  { tag: "PHOSPHATASE_INHIBITOR", pattern: /\b(phosphatase inhibitor|磷酸酶抑制剂)\b/ },
  { tag: "PROTEIN_QUANTIFICATION_REAGENT", pattern: /\b(bca|bradford|protein assay|蛋白定量)\b/ },
  { tag: "REDUCING_AGENT", pattern: /\b(dtt|beta-mercaptoethanol|2-mercaptoethanol|tcep)\b/ },
  { tag: "GEL_STAIN", pattern: /\b(coomassie|ponceau|sypro|gel stain)\b/ },
  { tag: "DNA_EXTRACTION_REAGENT", pattern: /\b(dna extraction|genomic dna|dna isolation)\b/ },
  { tag: "RNA_EXTRACTION_REAGENT", pattern: /\b(trizol|rna extraction|rna isolation|rnaeasy|rna prep)\b/ },
  { tag: "PLASMID_PREP_REAGENT", pattern: /\b(plasmid prep|miniprep|maxiprep|endofree)\b/ },
  { tag: "DNA_POLYMERASE", pattern: /\b(?:dna polymerase|taq polymerase|hot[-\s]?start taq|high[-\s]?fidelity polymerase|proofreading polymerase)\b/i },
  { tag: "PCR_PRIMER_SET", pattern: /\b(?:pcr|qpcr|rt[-\s]?pcr|lamp|rpa)?\s*(?:primer(?:\s+(?:set|pair|mix|panel))?|oligo(?:nucleotide)? primer)\b|引物(?:组|对|套装)?/i },
  { tag: "DNTP_MIX", pattern: /\bdntp(?:s)?(?:\s+mix)?\b|脱氧核苷三磷酸(?:混合液)?/i },
  { tag: "DNA_LIGASE", pattern: /\b(?:t4\s+)?dna ligase\b|dna连接酶/i },
  { tag: "RESTRICTION_ENDONUCLEASE", pattern: /\b(?:restriction endonuclease|restriction enzyme|type\s*iis)\b|限制性(?:内)?切酶/i },
  { tag: "DNA_BINDING_MAGNETIC_BEADS", pattern: /\b(?:ampure|spr[ie]\s+beads?|dna[-\s]?binding magnetic beads?)\b|dna磁珠/i },
  { tag: "CHIP_GRADE_ANTIBODY", pattern: /\bchip(?:[-\s]?grade)?\s+antibody\b|(?:chip|染色质免疫沉淀)(?:级|专用)?抗体/i },
  { tag: "PROTEIN_A_G_MAGNETIC_BEADS", pattern: /\bprotein\s*(?:a\/?g|a\s*(?:and|&)\s*g)\s*(?:magnetic\s*)?beads?\b|蛋白[AG](?:磁)?珠/i },
  { tag: "TRANSPOSASE_REAGENT", pattern: /\b(?:tn5|tagmentation|transposase)\b|转座酶/i },
  { tag: "NUCLEI_ISOLATION_REAGENT", pattern: /\b(?:nuclei|nuclear)\s+(?:isolation|extraction)(?:\s+(?:buffer|kit|reagent))?\b|细胞核(?:分离|提取)(?:液|试剂|试剂盒)?/i },
  { tag: "SINGLE_CELL_BARCODING_REAGENT", pattern: /\b(?:single[-\s]?cell|single[-\s]?nucleus)\s+(?:barcoding|barcode|partitioning)(?:\s+(?:kit|reagent))?\b|单(?:细胞|核)(?:条形码|建库|分隔)(?:试剂|试剂盒)?/i },
  { tag: "OLIGO_BARCODED_ANTIBODY_PANEL", pattern: /\b(?:oligo(?:nucleotide)?[-\s]?barcoded|adt|feature[-\s]?barcoding)\s+antibody(?:\s+panel)?\b|(?:寡核苷酸|条形码)(?:标记)?抗体(?:面板)?/i },
  { tag: "SPATIAL_PROBE_PANEL", pattern: /\b(?:spatial|in[-\s]?situ)\s+(?:rna\s+)?probe(?:\s+panel)?\b|(?:空间|原位)(?:转录组)?探针(?:面板)?/i },
  { tag: "CRISPR_GUIDE_LIBRARY", pattern: /\b(?:crispr|sgrna|grna|pegrna)\s+(?:guide\s+)?library\b|(?:CRISPR|sgRNA|gRNA|pegRNA)(?:文库|向导文库)/i },
  { tag: "TARGET_ENRICHMENT_PROBE", pattern: /\b(?:target|hybrid|capture)\s+(?:enrichment\s+)?probe(?:\s+panel)?\b|(?:靶向|杂交|捕获)(?:富集)?探针(?:面板)?/i },
  { tag: "BISULFITE_CONVERSION_REAGENT", pattern: /\bbisulfite\s+conversion(?:\s+(?:kit|reagent))?\b|亚硫酸氢盐(?:转化|转换)(?:试剂|试剂盒)?/i },
  { tag: "METABOLITE_EXTRACTION_REAGENT", pattern: /\b(?:metabolite|metabolomic|lipid)\s+extraction(?:\s+(?:solvent|kit|reagent))?\b|(?:代谢物|代谢组|脂质)(?:提取|萃取)(?:液|试剂|试剂盒)?/i },
  { tag: "HOST_DNA_DEPLETION_REAGENT", pattern: /\bhost\s+(?:dna\s+)?depletion(?:\s+(?:kit|reagent))?\b|宿主DNA(?:去除|耗竭)(?:试剂|试剂盒)?/i },
  { tag: "RRNA_DEPLETION_REAGENT", pattern: /\b(?:rRNA|ribosomal RNA)\s*(?:depletion|removal)\b|去除?核糖体RNA(?:试剂|试剂盒)?/i },
  { tag: "PHOSPHOPEPTIDE_ENRICHMENT_REAGENT", pattern: /\b(?:phosphopeptide enrichment|tio2 phosphopeptide|imac phosphopeptide|fe[-\s]?nTA phosphopeptide)\b|磷酸肽富集(?:试剂|材料)?/i },
  { tag: "STABLE_ISOTOPE_TRACER", pattern: /\b(?:stable isotope tracer|(?:u-)?(?:13c|15n|2h|d[2-9])[-\s]?(?:glucose|glutamine|palmitate|acetate|lactate))\b|稳定同位素(?:示踪|标记)(?:剂|底物)?/i },
  { tag: "PCR_MASTER_MIX", pattern: /\b(pcr master mix|taq mix|hot start taq|polymerase mix)\b/ },
  { tag: "REVERSE_TRANSCRIPTION_REAGENT", pattern: /\b(reverse transcription|cdna synthesis|rt kit|reverse transcriptase)\b/ },
  { tag: "QPCR_MASTER_MIX", pattern: /\b(sybr|taqman|qpcr master mix|real-time pcr mix)\b/ },
  { tag: "QPCR_PROBE", pattern: /\b(?:taqman|hydrolysis probe|qpcr probe|real[-\s]?time pcr probe)\b|qPCR探针/i },
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
  { tag: "ELISA_CAPTURE_ANTIBODY", pattern: /\b(?:elisa\s+)?capture antibody\b|捕获抗体/i },
  { tag: "ELISA_BLOCKING_REAGENT", pattern: /\b(elisa blocking|blocker|assay diluent)\b/ },
  { tag: "ELISA_WASH_BUFFER", pattern: /\b(elisa wash|wash concentrate)\b/ },
  { tag: "ELISA_SUBSTRATE", pattern: /\b(tmb|elisa substrate)\b/ },
  { tag: "ELISA_STANDARD", pattern: /\b(?:elisa|assay)\s+(?:standard|calibrator)\b|elisa标准品/i },
  { tag: "FLOW_ANTIBODY_PANEL", pattern: /\b(?:flow cytometry|facs|sorting)[-\s]?(?:validated\s+)?antibody panel\b|(?:流式|分选)(?:抗体)?面板/i },
  { tag: "FLOW_STAIN_BUFFER", pattern: /\b(facs buffer|flow staining buffer|stain buffer)\b/ },
  { tag: "FLOW_VIABILITY_DYE", pattern: /\b(7-aad|pi stain|propidium iodide|annexin v|viability dye)\b/ },
  { tag: "EXOSOME_ISOLATION_REAGENT", pattern: /\b(exosome isolation|ev isolation|extracellular vesicle isolation|exoquick)\b/ },
  {
    tag: "EXOSOME_DEPLETED_SERUM",
    pattern:
      /\b(?:(?:exosome|ev|extracellular vesicle)[-\s]?(?:depleted|free)\s+(?:fbs|fetal bovine serum|serum)|(?:exosome|ev)[-\s]?depleted\s+(?:fbs|serum))\b|(?:去|无)(?:外泌体|细胞外囊泡)(?:血清|FBS)/i,
  },
  {
    tag: "EXOSOME_CAPTURE_REAGENT",
    pattern:
      /\b(?:exosome|ev|extracellular vesicle)[\s\S]{0,50}\b(?:capture|immunocapture|affinity)\b|\banti[-\s]?(?:cd9|cd63|cd81)\b[\s\S]{0,50}\b(?:magnetic\s*)?beads?\b|(?:外泌体|细胞外囊泡)(?:免疫)?捕获/i,
  },
  {
    tag: "AUTOPHAGY_INDUCER",
    pattern: /\b(?:rapamycin|torin(?:[-\s]?1)?|pp242|ebss|starvation medium|autophagy inducer)\b|自噬(?:诱导剂|激活剂)|雷帕霉素/i,
  },
  {
    tag: "AUTOPHAGY_FLUX_INHIBITOR",
    pattern:
      /\b(?:bafilomycin(?:\s*a1)?|chloroquine|hydroxychloroquine|lysosomal inhibitor|autophagy flux inhibitor)\b|(?:巴弗|巴佛|巴伐)洛霉素|羟?氯喹|自噬(?:通量)?(?:抑制剂|阻断剂)/i,
  },
  {
    tag: "ECM_DEGRADATION_ASSAY_REAGENT",
    pattern:
      /\b(?:dq[-\s]?(?:collagen|gelatin)|mmp activity assay|(?:collagen|gelatin)[\s\S]{0,35}\b(?:degradation|cleavage|zymography)\b)\b|(?:基质|胶原|明胶)(?:降解|酶谱)|MMP活性(?:检测试剂|试剂盒)?/i,
  },
  {
    tag: "ECM_REMODELING_MODULATOR",
    pattern:
      /\b(?:gm6001|ilomastat|marimastat|batimastat|beta[-\s]?aminopropionitrile|bapn|lysyl oxidase inhibitor|mmp inhibitor)\b|(?:基质|ECM)(?:重塑)?(?:抑制剂|调节剂)|(?:MMP|赖氨酰氧化酶)(?:抑制剂|调节剂)/i,
  },
  { tag: "MITOCHONDRIAL_STAIN", pattern: /\bmitotracker\b|线粒体(?:特异)?染料/i },
  {
    tag: "MITOCHONDRIAL_MEMBRANE_POTENTIAL_DYE",
    pattern:
      /\b(?:jc[-\s]?1|tmrm|tmre|rhodamine\s*123|mitochondrial membrane potential (?:dye|assay|kit))\b|线粒体膜电位(?:染料|检测试剂|试剂盒)?/i,
  },
  { tag: "MITOCHONDRIAL_SUPEROXIDE_DYE", pattern: /\bmitosox\b|线粒体超氧(?:化物)?(?:染料|探针|检测试剂)?/i },
  {
    tag: "MITOCHONDRIAL_RESPIRATION_ASSAY_REAGENT",
    pattern:
      /\b(?:seahorse[\s\S]{0,45}(?:mito|respiration|stress)|(?:mitochondrial respiration|oxygen consumption)[\s\S]{0,45}(?:assay|kit|reagent))\b|线粒体(?:呼吸|氧耗)(?:检测试剂|试剂盒|体系)?/i,
  },
  {
    tag: "MITOCHONDRIAL_STRESSOR",
    pattern: /\b(?:oligomycin|fccp|carbonyl cyanide|rotenone|antimycin(?:\s*a)?)\b|线粒体(?:应激|压力)试剂/i,
  },
  {
    tag: "TYPE_I_INTERFERON_REAGENT",
    pattern: /\b(?:ifn|interferon)[-\s]?(?:alpha|a|beta|b|α|β)(?:\b|(?=[^a-z0-9]|$))|(?:I型|1型)?干扰素[-\s]?(?:α|a|β|b)/i,
  },
  {
    tag: "TYPE_II_INTERFERON_REAGENT",
    pattern: /\b(?:ifn|interferon)[-\s]?(?:gamma|g|γ)(?:\b|(?=[^a-z0-9]|$))|(?:II型|2型)?干扰素[-\s]?(?:γ|g)/i,
  },
  {
    tag: "INTERFERON_PATHWAY_MODULATOR",
    pattern:
      /\b(?:ruxolitinib|tofacitinib|baricitinib|fedratinib|jak(?:1|2|3)?(?:\s*\/\s*jak\d+)? inhibitor|stat1 inhibitor|interferon pathway (?:inhibitor|modulator))\b|(?:JAK|STAT|干扰素)(?:通路)?(?:抑制剂|调节剂)/i,
  },
  {
    tag: "INNATE_IMMUNE_STIMULANT",
    pattern:
      /\b(?:lps|lipopolysaccharide|poly\s*i:c|polyinosinic|imiquimod|resiquimod|cpg(?:[-\s]?(?:odn|dna))?|pam3csk4|flagellin)\b|脂多糖|聚肌胞|咪喹莫特|瑞喹莫德|鞭毛蛋白/i,
  },
  {
    tag: "INFLAMMASOME_ACTIVATOR",
    pattern:
      /\b(?:nigericin|msu(?:\s+crystals?)?|alum|inflammasome activator|pyroptosis inducer)\b|(?:炎症小体|焦亡)(?:激活剂|诱导剂)|尼日利亚菌素|尿酸单钠(?:结晶)?/i,
  },
  {
    tag: "T_CELL_ACTIVATION_REAGENT",
    pattern:
      /\b(?:anti[-\s]?cd3(?:\s*\/\s*(?:anti[-\s]?)?cd28)?|cd3\s*\/\s*cd28|t[-\s]?cell activation|t[-\s]?cell expander|dynabeads[\s\S]{0,40}cd3[\s\S]{0,40}cd28)\b|T细胞(?:激活|扩增)/i,
  },
  {
    tag: "T_CELL_LINEAGE_MARKER_REAGENT",
    pattern:
      /\banti[-\s]?(?:cd3|cd4|cd8a?|tcr(?:alpha|beta)?|trac|cd25|cd69)\b|\b(?:cd3|cd4|cd8a?|tcr(?:alpha|beta)?|trac|cd25|cd69)\b(?=[\s\S]{0,70}\b(?:antibody|fitc|pe|apc|percp|bv\d+|panel|beads?)\b)|T细胞(?:标志物)?抗体/i,
  },
  {
    tag: "B_CELL_ACTIVATION_REAGENT",
    pattern:
      /\b(?:anti[-\s]?(?:igm|igd)|b[-\s]?cell activation|cd40l|cd40 ligand)\b|B细胞(?:激活剂|活化剂)|抗(?:IgM|IgD)/i,
  },
  {
    tag: "B_CELL_LINEAGE_MARKER_REAGENT",
    pattern:
      /\banti[-\s]?(?:cd19|cd20|cd79a|cd27|cd38|cd138)\b|\b(?:cd19|cd20|cd79a|cd27|cd38|cd138)\b(?=[\s\S]{0,70}\b(?:antibody|fitc|pe|apc|percp|bv\d+|panel|beads?)\b)|B细胞(?:标志物)?抗体/i,
  },
  {
    tag: "NK_CELL_ACTIVATION_REAGENT",
    pattern:
      /\b(?:il[-\s]?15|nk[-\s]?cell activation|natural killer[\s\S]{0,40}(?:activation|expansion)|(?:il[-\s]?(?:2|12|15|18))[\s\S]{0,40}(?:nk|natural killer))\b|NK细胞(?:激活|扩增)/i,
  },
  {
    tag: "NK_CELL_MARKER_REAGENT",
    pattern:
      /\banti[-\s]?(?:cd56|cd16|cd94|nkg2d|nkp(?:30|44|46)|ncr1)\b|\b(?:cd56|cd16|cd94|nkg2d|nkp(?:30|44|46)|ncr1)\b(?=[\s\S]{0,70}\b(?:antibody|fitc|pe|apc|percp|bv\d+|panel|beads?)\b)|NK细胞(?:标志物)?抗体/i,
  },
  {
    tag: "MYELOID_POLARIZATION_REAGENT",
    pattern:
      /\b(?:m[-\s]?csf|csf1|gm[-\s]?csf|macrophage polarization|monocyte differentiation|dendritic cell maturation)\b|(?:巨噬|单核|树突)(?:细胞)?(?:极化|分化|成熟)/i,
  },
  {
    tag: "MYELOID_LINEAGE_MARKER_REAGENT",
    pattern:
      /\banti[-\s]?(?:cd14|cd11b|cd68|cd163|cd206|hla[-\s]?dr)\b|\b(?:cd14|cd11b|cd68|cd163|cd206|hla[-\s]?dr)\b(?=[\s\S]{0,70}\b(?:antibody|fitc|pe|apc|percp|bv\d+|panel|beads?)\b)|(?:髓系|巨噬|单核)(?:细胞)?(?:标志物)?抗体/i,
  },
  {
    tag: "IMMUNE_CHECKPOINT_REAGENT",
    pattern:
      /\b(?:pd[-\s]?1|pdcd1|pd[-\s]?l1|cd274|ctla[-\s]?4|lag[-\s]?3|tigit|tim[-\s]?3|havcr2)\b|(?:PD[-\s]?1|PD[-\s]?L1|CTLA[-\s]?4|LAG[-\s]?3|TIGIT|TIM[-\s]?3)(?:抗体|抑制剂|激动剂)?/i,
  },
  {
    tag: "IMMUNE_METABOLISM_MODULATOR",
    pattern:
      /\b(?:2[-\s]?deoxy(?:-d)?[-\s]?glucose|2[-\s]?dg|etomoxir|metformin)\b|(?:免疫|T细胞|B细胞|NK|巨噬)(?:代谢)?[\s\S]{0,40}(?:2[-\s]?DG|依托莫昔|二甲双胍)/i,
  },
  {
    tag: "ANTIGEN_PRESENTATION_REAGENT",
    pattern:
      /\b(?:ovalbumin|\bova\b|siinfe?kl|antigen presentation|mhc\s*(?:i|ii)\s*peptide|hla[-\s]?(?:i|ii)\s*peptide|hla[-\s]?dr|cd(?:74|80|86)|dendritic cell maturation)\b|(?:抗原呈递|抗原肽|OVA肽|树突细胞成熟)/i,
  },
  {
    tag: "COMPLEMENT_FC_EFFECTOR_REAGENT",
    pattern:
      /\b(?:complement\s+(?:serum|component|reagent|protein|inhibitor)|c3a|c5a|cobra venom factor|eculizumab|fc effector)\b|(?:补体|Fc效应)(?:血清|成分|试剂|蛋白|抑制剂)?/i,
  },
  { tag: "IMMUNE_CHEMOTAXIS_REAGENT", pattern: /\b(?:chemokine|cxcl\d+|ccl\d+|sdf[-\s]?1)\b|趋化因子/i },
  {
    tag: "FC_RECEPTOR_BLOCKING_REAGENT",
    pattern: /\b(?:fc(?:gamma)?\s*(?:receptor)?\s*block(?:ing)?|cd16\s*\/\s*32\s*(?:block(?:ing)?|antibody))\b|Fc(?:受体)?封闭(?:剂|液)?/i,
  },
  {
    tag: "IMMUNE_CELL_ENRICHMENT_REAGENT",
    pattern:
      /\b(?:magnetic[-\s]?activated cell sorting|macs|immune[-\s]?cell isolation|(?:cd3|cd4|cd8|cd19|cd20|cd14|cd56)[\s-]*(?:microbeads|isolation kit))\b|(?:免疫细胞|T细胞|B细胞|NK细胞)(?:磁珠)?分选/i,
  },
  { tag: "HISTOLOGY_STAIN_REAGENT", pattern: /\b(?:hematoxylin|eosin|masson|periodic acid schiff|alcian blue|sirius red|giemsa|nissl|oil red o|crystal violet)\b|(?:苏木精|伊红|masson|过碘酸|阿利新蓝|天狼星红|吉姆萨|尼氏|油红o|结晶紫)(?:染色)?/i },
  { tag: "MICROBIAL_CULTURE_MEDIUM", pattern: /\b(?:lb(?:\s+(?:broth|agar))?|nutrient (?:broth|agar)|tryptic soy(?:\s+(?:broth|agar))?|bhi(?:\s+(?:broth|agar))?|mueller[-\s]?hinton|sabouraud|microbial culture medium)\b|(?:营养|菌)?(?:肉汤|琼脂)|微生物培养基/i },
  { tag: "CALIBRATION_STANDARD", pattern: /\b(?:calibration standard|reference standard|certified reference material|assay calibrator|platform calibrator)\b|(?:校准|参考)标准(?:品|物)|校准物/i },
  { tag: "INTERNAL_STANDARD", pattern: /\b(?:internal standard|isotope[-\s]?labeled standard|spike[-\s]?in standard)\b|内标(?:准品)?|同位素内标/i },
  { tag: "LIBRARY_PREPARATION_REAGENT", pattern: /\b(?:library prep(?:aration)? kit|tagmentation kit|library construction kit)\b|(?:文库制备|建库)试剂盒/i },
  { tag: "SEQUENCING_RUN_REAGENT", pattern: /\b(?:sequencing reagent kit|sequencing run reagent|flow cell reagent)\b|测序试剂盒|上机试剂/i },
  { tag: "INDEXING_PRIMER", pattern: /\b(?:index(?:ing)? primer|barcode primer|index adapter)\b|(?:索引|条形码)引物|接头引物/i },
  { tag: "OMICS_LABELING_REAGENT", pattern: /\b(?:tmt(?:pro)?|itraq|omics labeling|derivatization reagent)\b|(?:组学)?标记试剂|衍生化试剂/i },
  { tag: "ANALGESIC_REAGENT", pattern: /\b(?:buprenorphine|meloxicam|carprofen|analgesic)\b|镇痛(?:剂|药)/i },
];

function uniq<T>(items: T[]) {
  return [...new Set(items)];
}

export function extractTargetName(name: string) {
  const lowered = name.toLowerCase();
  const antiMatch = lowered.match(/\banti[-–—\s]+([a-z0-9/+-]+)/);
  if (antiMatch?.[1]) return normalizeTargetName(antiMatch[1]);
  const antibodyMatch = lowered.match(/([a-z0-9/+-]+)\s+antibody/);
  if (antibodyMatch?.[1]) return normalizeTargetName(antibodyMatch[1]);
  const primerMatch = lowered.match(/([a-z0-9/+-]+)\s+(primer|probe)/);
  if (primerMatch?.[1]) return normalizeTargetName(primerMatch[1]);
  return null;
}

export function detectAntibodyMeta(name: string): ParsedAntibodyMeta | null {
  const lowered = name.toLowerCase();
  if (!antibodySignalPattern.test(lowered)) return null;

  const isSecondary = isSecondaryAntibodyName(lowered);
  const species = antibodySpecies.join("|");
  const secondaryHostMatch = lowered.match(new RegExp(`\\b(${species})\\s+anti[-–—\\s]?(${species})\\b`, "i"));
  const antiTargetSpeciesMatch = lowered.match(new RegExp(`\\banti[-–—\\s]?(${species})\\b`, "i"));
  const hostSpecies = isSecondary
    ? formatSpecies(secondaryHostMatch?.[1]) ?? speciesPatterns.find((item) => item.pattern.test(lowered))?.value ?? null
    : speciesPatterns.find((item) => item.pattern.test(lowered))?.value ?? null;
  const isRoleAmbiguous = isotypeControlPattern.test(lowered) || elisaAntibodyPattern.test(lowered) || (antibodyConjugatePattern.test(lowered) && !/\bprimary\s+antibody\b|一抗/i.test(lowered));

  return {
    role: isSecondary ? "SECONDARY" : isRoleAmbiguous ? null : "PRIMARY",
    hostSpecies,
    targetSpecies: isSecondary ? antiTargetSpeciesMatch?.[1] ?? null : null,
    targetName: isSecondary || isRoleAmbiguous ? null : extractTargetName(name),
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
    tags.push("WB_PRIMARY_ANTIBODY");
    if (/\b(if|immunofluorescence|immunostaining)\b|免疫荧光|荧光染色/i.test(lowered)) tags.push("IF_PRIMARY_ANTIBODY");
    if (/\b(flow|facs)\b|流式/i.test(lowered)) tags.push("FLOW_PRIMARY_ANTIBODY");
  }

  if (antibodyMeta?.role === "SECONDARY") {
    if (/hrp/.test(lowered)) tags.push("WB_SECONDARY_ANTIBODY", "ELISA_DETECTION_ANTIBODY");
    if (/alexa|fitc|pe|apc|percp|cy3|cy5|fluor|fluorescent|488|555|594|647/.test(lowered)) {
      tags.push("IF_FLUORESCENT_SECONDARY_ANTIBODY", "FLOW_FLUORESCENT_ANTIBODY");
    }
  }

  if (/primary antibody/.test(lowered) && /flow|facs/.test(lowered)) {
    tags.push("FLOW_PRIMARY_ANTIBODY");
  }

  if (antibodySignalPattern.test(lowered) && /flow|facs|cd\d+|流式/.test(lowered) && /fitc|pe|apc|percp|bv\d+|fluor/.test(lowered)) {
    tags.push("FLOW_FLUORESCENT_ANTIBODY");
  }

  return supplementReagentCapabilityTags(name, uniq(tags));
}

export function detectCategory(name: string): ReagentCategory {
  const lowered = name.toLowerCase();
  const signals = buildSignalSet(name);
  const isGeneDelivery = /\b(lentivirus|adenovirus|aav|transfect|lipofectamine|lipo\s*3000|lipo3000|electroporation|转染|转导)\b/.test(lowered);
  if (/primer|probe/.test(lowered)) return "PRIMER";
  if (antibodySignalPattern.test(lowered)) return "ANTIBODY";
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
  if (
    /trizol|dnase|rnase|triton|dapi|paraformaldehyde|methanol|acetone|ethanol|tribromoethanol|avertin|puromycin|blasticidin|g418|dmso|mitotracker|mitosox|tmrm|tmre|jc[-\s]?1|bafilomycin|chloroquine|hydroxychloroquine|rapamycin|torin|oligomycin|fccp|rotenone|antimycin|nigericin|ruxolitinib|tofacitinib|baricitinib|fedratinib|etomoxir|2[-\s]?deoxy(?:-d)?[-\s]?glucose|2[-\s]?dg|乙醇|酒精|三溴乙醇|阿(?:佛|弗)丁|雷帕霉素|羟?氯喹|尼日利亚菌素/.test(
      lowered,
    ) ||
    isGeneDelivery
  ) {
    return "CHEMICAL";
  }
  if (/membrane|plate|slide|filter|dish|flask|syringe|pipette tip|tube|培养皿|培养板|培养瓶|注射器/.test(lowered)) return "CONSUMABLE";
  return "OTHER";
}

export function detectSubCategory(name: string, tags: ExperimentTag[], category?: ReagentCategory) {
  const signals = buildSignalSet(name);
  if (tags.includes("TRANSFECTION_REAGENT")) return "Transfection Reagent";
  if (tags.includes("CELL_CULTURE_MEDIUM")) return "Cell Culture Medium";
  if (tags.includes("WB_PROTEIN_MARKER")) return "Protein Molecular Weight Marker";
  if (tags.includes("CELL_STAIN_REAGENT")) return "Cell Stain";
  if (tags.includes("CELL_CULTURE_VESSEL")) return "Cell Culture Vessel";
  if (tags.includes("SYRINGE_CONSUMABLE")) return "Syringe";
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

type ParsedReagentResultLike = {
  category: ReagentCategory;
  subCategory?: string | null;
  experimentTags?: ExperimentTag[];
  antibodyMeta?: ParsedAntibodyMeta | null;
};

// LLM outputs are intentionally conservative and may omit a tag even when the
// product name itself supplies unambiguous evidence. Apply these deterministic
// repairs after every parse path, rather than only in the failure fallback.
export function enrichParsedReagentResult<T extends ParsedReagentResultLike>(input: ReagentParseInput, parsed: T): T {
  const searchText = buildSearchText(input);
  const detectedAntibodyMeta = detectAntibodyMeta(input.name);
  const isAntibody = parsed.category === "ANTIBODY" || Boolean(detectedAntibodyMeta);
  const shouldUseDetectedSecondary = detectedAntibodyMeta?.role === "SECONDARY";
  const shouldClearPrimaryRole = detectedAntibodyMeta?.role === null;
  const parsedAntibodyMeta = parsed.antibodyMeta ?? null;
  const antibodyMeta = isAntibody
    ? {
        role: shouldUseDetectedSecondary
          ? "SECONDARY"
          : shouldClearPrimaryRole
            ? null
            : parsedAntibodyMeta?.role ?? detectedAntibodyMeta?.role ?? null,
        hostSpecies: shouldUseDetectedSecondary
          ? detectedAntibodyMeta?.hostSpecies ?? parsedAntibodyMeta?.hostSpecies ?? null
          : parsedAntibodyMeta?.hostSpecies ?? detectedAntibodyMeta?.hostSpecies ?? null,
        targetSpecies: shouldUseDetectedSecondary
          ? detectedAntibodyMeta?.targetSpecies ?? parsedAntibodyMeta?.targetSpecies ?? null
          : parsedAntibodyMeta?.targetSpecies ?? detectedAntibodyMeta?.targetSpecies ?? null,
        targetName: shouldUseDetectedSecondary || shouldClearPrimaryRole
          ? null
          : parsedAntibodyMeta?.targetName ?? detectedAntibodyMeta?.targetName ?? null,
      }
    : parsedAntibodyMeta;
  const detectedTags = detectExperimentTags(searchText, antibodyMeta);
  const cultureMediumMatcher = baseTagMatchers.find((matcher) => matcher.tag === "CELL_CULTURE_MEDIUM");
  const parsedSubCategory = parsed.subCategory?.trim().toLowerCase();
  const hasCultureMediumEvidence =
    Boolean(cultureMediumMatcher?.pattern.test(searchText)) ||
    (parsed.category === "BUFFER" && parsedSubCategory === "cell culture medium");
  const experimentTags = uniq([...(parsed.experimentTags ?? []), ...detectedTags]).filter((tag) => {
    if (antibodyMeta?.role !== "PRIMARY" && antibodyPrimaryTagSet.has(tag)) return false;
    return tag !== "CELL_CULTURE_MEDIUM" || hasCultureMediumEvidence;
  });
  const consumableTagDetected = experimentTags.some((tag) => tag === "CELL_CULTURE_VESSEL" || tag === "SYRINGE_CONSUMABLE");
  const proteinMarkerDetected = experimentTags.includes("WB_PROTEIN_MARKER");
  const chemicalTagDetected = experimentTags.some((tag) =>
    tag === "ANESTHETIC_REAGENT" || tag === "SOLVENT_REAGENT" || tag === "DISINFECTION_REAGENT",
  );
  const category = isAntibody
    ? "ANTIBODY"
    : consumableTagDetected
      ? "CONSUMABLE"
      : chemicalTagDetected
        ? "CHEMICAL"
        : proteinMarkerDetected
          ? "BIOLOGICAL"
          : parsed.category;
  const detectedSubCategory = detectSubCategory(searchText, experimentTags, category);
  const subCategory = ["Cell Stain", "Cell Culture Vessel", "Syringe", "Protein Molecular Weight Marker"].includes(detectedSubCategory ?? "")
    ? detectedSubCategory
    : parsed.subCategory;

  return {
    ...parsed,
    category,
    subCategory,
    experimentTags,
    antibodyMeta,
  } as T;
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
