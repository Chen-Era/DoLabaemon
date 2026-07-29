export type IntegrativeDomainCode =
  | "GENOME_VARIATION"
  | "EPIGENOME_CHROMATIN"
  | "TRANSCRIPTOME_RNA_REGULATION"
  | "SINGLE_CELL_MULTIOMICS"
  | "SPATIAL_BIOLOGY"
  | "PROTEOMICS_SIGNALING"
  | "METABOLISM_LIPIDOMICS"
  | "FUNCTIONAL_GENOMICS"
  | "IMMUNE_SYSTEMS"
  | "MICROBIOME_HOST"
  | "STEM_CELL_DEVELOPMENT"
  | "EXTRACELLULAR_VESICLES";

export type IntegrativeBiologyDomain = {
  code: IntegrativeDomainCode;
  name: { zh: string; en: string };
  description: { zh: string; en: string };
  specializedReagents: { zh: string; en: string };
  targetRequirements: { zh: string; en: string };
  techniqueCodes: readonly string[];
};

/**
 * A compact, method-linked view of mainstream integrative-biology research.
 * The domain labels intentionally describe a research question rather than a
 * vendor platform, so a lab can compare compatible methods without being
 * locked to one manufacturer.
 */
export const integrativeBiologyDomains: readonly IntegrativeBiologyDomain[] = [
  {
    code: "GENOME_VARIATION",
    name: { zh: "基因组与遗传变异", en: "Genomics and genetic variation" },
    description: {
      zh: "覆盖全基因组、外显子、靶向面板和单细胞DNA层面的变异、拷贝数、结构变异与克隆演化研究。",
      en: "Covers genome-wide, exome, targeted-panel, and single-cell DNA studies of variants, copy number, structural variation, and clonal evolution.",
    },
    specializedReagents: {
      zh: "高分子量DNA提取体系、靶向捕获探针、文库与上机试剂，以及低频变异参考标准品。",
      en: "High-molecular-weight DNA extraction, target-enrichment probes, library/run reagents, and low-frequency-variant reference materials.",
    },
    targetRequirements: {
      zh: "预先冻结基因/区域清单、覆盖深度和等位基因频率阈值；明确生殖系、体细胞或克隆层面的判读目标。",
      en: "Freeze the gene/region list, coverage, and allele-frequency threshold in advance, and specify germline, somatic, or clonal interpretation goals.",
    },
    techniqueCodes: [
      "ILLUMINA_SHORT_READ_WHOLE_GENOME_SEQUENCING",
      "PACBIO_HIFI_WHOLE_GENOME_SEQUENCING",
      "OXFORD_NANOPORE_WHOLE_GENOME_SEQUENCING",
      "WHOLE_EXOME_SEQUENCING",
      "TARGETED_AMPLICON_SEQUENCING",
      "HYBRID_CAPTURE_GENE_PANEL_SEQUENCING",
      "SINGLE_CELL_DNA_SEQUENCING",
    ],
  },
  {
    code: "EPIGENOME_CHROMATIN",
    name: { zh: "表观遗传与染色质调控", en: "Epigenomics and chromatin regulation" },
    description: {
      zh: "覆盖染色质可及性、转录因子/组蛋白占位、DNA甲基化和三维基因组。",
      en: "Covers chromatin accessibility, transcription-factor and histone occupancy, DNA methylation, and three-dimensional genome organization.",
    },
    specializedReagents: {
      zh: "ChIP/CUT验证抗体、Protein A/G磁珠、Tn5、亚硫酸氢盐转换体系、限制性内切酶及捕获探针。",
      en: "ChIP/CUT-validated antibodies, Protein A/G beads, Tn5, bisulfite conversion chemistry, restriction enzymes, and capture probes.",
    },
    targetRequirements: {
      zh: "为每个转录因子或组蛋白修饰指定目标与阴性位点；同时定义开放区、CpG区或染色质锚点的分析范围。",
      en: "For every transcription factor or histone mark, specify target and negative loci and define the accessible region, CpG region, or chromatin anchor to analyze.",
    },
    techniqueCodes: [
      "CHIP_QPCR",
      "CHIP_SEQUENCING",
      "CUT_AND_RUN",
      "CUT_AND_TAG",
      "ATAC_QPCR",
      "ATAC_SEQUENCING",
      "DNASE_SEQUENCING",
      "WHOLE_GENOME_BISULFITE_SEQUENCING",
      "REDUCED_REPRESENTATION_BISULFITE_SEQUENCING",
      "DNA_METHYLATION_ARRAY",
      "HI_C_CHROMOSOME_CONFORMATION_CAPTURE",
      "CAPTURE_HI_C",
      "FOUR_C_SEQUENCING",
    ],
  },
  {
    code: "TRANSCRIPTOME_RNA_REGULATION",
    name: { zh: "转录组与RNA调控", en: "Transcriptomics and RNA regulation" },
    description: {
      zh: "覆盖编码/非编码RNA、异构体、翻译、RNA结合蛋白与转录后调控。",
      en: "Covers coding and noncoding RNA, isoforms, translation, RNA-binding proteins, and post-transcriptional regulation.",
    },
    specializedReagents: {
      zh: "RNA保护与去rRNA体系、长读长或小RNA建库试剂、逆转录体系，以及交联免疫沉淀抗体和RNA酶控制体系。",
      en: "RNA protection and rRNA-depletion chemistry, long-read or small-RNA library reagents, reverse transcription, and crosslink-IP antibodies with controlled RNase treatment.",
    },
    targetRequirements: {
      zh: "明确基因、转录本、剪接事件或RNA结合蛋白；为候选验证预设阳性/阴性转录本与位点。",
      en: "Define the gene, transcript, splice event, or RNA-binding protein and prespecify positive and negative transcripts or loci for candidate validation.",
    },
    techniqueCodes: [
      "BULK_POLY_A_RNA_SEQUENCING",
      "TOTAL_RNA_SEQUENCING",
      "LONG_READ_RNA_SEQUENCING",
      "SMALL_RNA_SEQUENCING",
      "RIBOSOME_PROFILING",
      "ECLIP_SEQUENCING",
      "RIP_SEQUENCING",
    ],
  },
  {
    code: "SINGLE_CELL_MULTIOMICS",
    name: { zh: "单细胞与多组学", en: "Single-cell and multi-omics" },
    description: {
      zh: "覆盖细胞/细胞核转录组、染色质可及性、RNA-ATAC、RNA-蛋白、单细胞DNA和扰动读出。",
      en: "Covers cell and nucleus transcriptomes, chromatin accessibility, RNA–ATAC, RNA–protein, single-cell DNA, and perturbation readouts.",
    },
    specializedReagents: {
      zh: "温和解离或核提取体系、单细胞条形码建库试剂、Tn5、样本哈希试剂及寡核苷酸条形码抗体面板。",
      en: "Gentle dissociation or nuclei-isolation chemistry, single-cell barcoding reagents, Tn5, sample hashing, and oligonucleotide-barcoded antibody panels.",
    },
    targetRequirements: {
      zh: "定义最小目标细胞数、细胞类型/状态标记、双细胞和环境RNA阈值，并在设计阶段平衡批次与样本来源。",
      en: "Define the minimum target cell count, cell-type/state markers, doublet and ambient-RNA thresholds, and balance batches and sample sources at design time.",
    },
    techniqueCodes: [
      "DROPLET_SINGLE_CELL_RNA_SEQUENCING",
      "SINGLE_NUCLEUS_RNA_SEQUENCING",
      "SINGLE_CELL_ATAC_SEQUENCING",
      "SINGLE_CELL_MULTIOME_RNA_ATAC_SEQUENCING",
      "CITE_SEQUENCING",
      "SINGLE_CELL_VDJ_SEQUENCING",
      "SINGLE_CELL_DNA_SEQUENCING",
      "PERTURB_SEQUENCING",
    ],
  },
  {
    code: "SPATIAL_BIOLOGY",
    name: { zh: "空间生物学", en: "Spatial biology" },
    description: {
      zh: "覆盖捕获式和成像式空间转录组，以及多重空间蛋白表型和细胞邻域分析。",
      en: "Covers capture- and imaging-based spatial transcriptomics, multiplex spatial protein phenotyping, and cellular-neighborhood analysis.",
    },
    specializedReagents: {
      zh: "组织固定/透化体系、空间条形码或原位探针面板、组织兼容的封片体系及多重抗体面板。",
      en: "Tissue fixation/permeabilization chemistry, spatial barcodes or in-situ probe panels, tissue-compatible mounting, and multiplex antibody panels.",
    },
    targetRequirements: {
      zh: "锁定组织区域、细胞邻域假设和目标基因/蛋白面板；采用组织阳性区和无探针/同型对照验证定位。",
      en: "Lock the tissue regions, cellular-neighborhood hypothesis, and target gene/protein panel; validate localization with positive regions and no-probe or isotype controls.",
    },
    techniqueCodes: [
      "CAPTURE_BASED_SPATIAL_TRANSCRIPTOMICS",
      "IMAGING_BASED_SPATIAL_TRANSCRIPTOMICS",
      "SPATIAL_PROTEOMICS",
    ],
  },
  {
    code: "PROTEOMICS_SIGNALING",
    name: { zh: "蛋白质组与信号转导", en: "Proteomics and signaling" },
    description: {
      zh: "覆盖发现型、定量型和磷酸化蛋白质组，并与蛋白互作和信号通路验证衔接。",
      en: "Covers discovery, quantitative, and phosphoproteomics and connects them to protein-interaction and signaling-pathway validation.",
    },
    specializedReagents: {
      zh: "蛋白酶/磷酸酶抑制剂、消化与标记试剂、磷酸肽富集材料、同位素内标和质谱级溶剂。",
      en: "Protease/phosphatase inhibitors, digestion and labeling reagents, phosphopeptide enrichment media, isotope internal standards, and MS-grade solvents.",
    },
    targetRequirements: {
      zh: "为候选蛋白、磷酸化位点或激酶-底物轴定义定量肽、归一化策略和正交验证抗体。",
      en: "For candidate proteins, phosphosites, or kinase–substrate axes, define quantotypic peptides, normalization, and orthogonal validation antibodies.",
    },
    techniqueCodes: [
      "DDA_LC_MS_PROTEOMICS",
      "DIA_LC_MS_PROTEOMICS",
      "TMT_MULTIPLEXED_PROTEOMICS",
      "PHOSPHOPROTEOMICS",
      "TARGETED_LC_MS_MS_QUANTIFICATION",
    ],
  },
  {
    code: "METABOLISM_LIPIDOMICS",
    name: { zh: "代谢组、脂质组与代谢通量", en: "Metabolomics, lipidomics, and metabolic flux" },
    description: {
      zh: "覆盖非靶向和靶向代谢组、稳定同位素示踪及脂质分子种分析。",
      en: "Covers untargeted and targeted metabolomics, stable-isotope tracing, and lipid-species analysis.",
    },
    specializedReagents: {
      zh: "预冷提取溶剂、校准/同位素内标、稳定同位素示踪底物和脂质类别参考标准。",
      en: "Pre-chilled extraction solvents, calibration and isotope internal standards, stable-isotope tracer substrates, and lipid-class reference standards.",
    },
    targetRequirements: {
      zh: "定义代谢物或脂质类别、定量范围、内标配对及示踪底物对应的碳/氮流向假设。",
      en: "Define metabolites or lipid classes, quantitation range, internal-standard pairing, and the carbon/nitrogen-flow hypothesis for tracer substrates.",
    },
    techniqueCodes: [
      "UNTARGETED_LC_MS_METABOLOMICS",
      "UNTARGETED_GC_MS_METABOLOMICS",
      "TARGETED_LC_MS_METABOLOMICS",
      "STABLE_ISOTOPE_TRACING_METABOLOMICS",
      "LC_MS_LIPIDOMICS",
    ],
  },
  {
    code: "FUNCTIONAL_GENOMICS",
    name: { zh: "功能基因组与扰动筛选", en: "Functional genomics and perturbation screens" },
    description: {
      zh: "覆盖CRISPR编辑、CRISPRi、池化筛选与单细胞扰动读出，用于从相关性走向因果验证。",
      en: "Covers CRISPR editing, CRISPRi, pooled screens, and single-cell perturbation readouts to move from association to causal validation.",
    },
    specializedReagents: {
      zh: "经测序验证的sgRNA/pegRNA文库、Cas效应器、递送载体、选择试剂和编辑结果建库体系。",
      en: "Sequence-verified sgRNA/pegRNA libraries, Cas effectors, delivery vectors, selection reagents, and edit-outcome library chemistry.",
    },
    targetRequirements: {
      zh: "明确目标基因集、每基因向导数、阴性/阳性向导、覆盖度、MOI与脱靶复核策略。",
      en: "Specify the target gene set, guides per gene, negative/positive guides, representation, MOI, and off-target review strategy.",
    },
    techniqueCodes: [
      "CRISPR_CAS9_KNOCKOUT",
      "CRISPRI_TRANSCRIPTIONAL_REPRESSION",
      "POOLED_CRISPR_CAS9_SCREEN",
      "CRISPR_INTERFERENCE_SCREEN",
      "PERTURB_SEQUENCING",
    ],
  },
  {
    code: "IMMUNE_SYSTEMS",
    name: { zh: "免疫系统与免疫组库", en: "Immune systems and repertoire" },
    description: {
      zh: "覆盖免疫细胞表型、RNA-蛋白联测、T/B细胞受体克隆型和功能性免疫读出。",
      en: "Covers immune-cell phenotyping, joint RNA–protein measurement, T/B-cell receptor clonotypes, and functional immune readouts.",
    },
    specializedReagents: {
      zh: "流式或寡核苷酸条形码抗体面板、活死染、Fc受体封闭试剂、V(D)J引物和抗原/刺激物。",
      en: "Flow or oligonucleotide-barcoded antibody panels, viability dye, Fc-receptor block, V(D)J primers, and antigens or stimuli.",
    },
    targetRequirements: {
      zh: "预定义谱系、活化/耗竭/记忆标志物与克隆型问题；面板中必须包含阴性、FMO或同型对照。",
      en: "Predefine lineage, activation/exhaustion/memory markers and the clonotype question; include negative, FMO, or isotype controls in the panel.",
    },
    techniqueCodes: ["FLOW", "CITE_SEQUENCING", "SINGLE_CELL_VDJ_SEQUENCING", "PHOSPHO_FLOW"],
  },
  {
    code: "MICROBIOME_HOST",
    name: { zh: "微生物组与宿主互作", en: "Microbiome and host interaction" },
    description: {
      zh: "覆盖16S/ITS、宏基因组、宏转录组、宏蛋白组及其与宿主表型的整合。",
      en: "Covers 16S/ITS, metagenomics, metatranscriptomics, metaproteomics, and their integration with host phenotypes.",
    },
    specializedReagents: {
      zh: "低生物量DNA/RNA提取体系、宿主DNA去除或富集试剂、扩增引物、去rRNA体系和环境空白控制材料。",
      en: "Low-biomass DNA/RNA extraction, host-DNA depletion or enrichment, amplicon primers, rRNA-depletion chemistry, and field/process blank materials.",
    },
    targetRequirements: {
      zh: "明确分类群、功能通路或抗性基因目标，并把提取空白、采样空白和模拟群落作为必需质量控制。",
      en: "Define taxonomic, functional-pathway, or resistance-gene targets, and make extraction blanks, sampling blanks, and mock communities mandatory QC.",
    },
    techniqueCodes: [
      "SIXTEEN_S_RRNA_GENE_AMPLICON_SEQUENCING",
      "ITS_RRNA_AMPLICON_SEQUENCING",
      "SHOTGUN_METAGENOMIC_SEQUENCING",
      "METATRANSCRIPTOMIC_SEQUENCING",
      "METAPROTEOMICS",
    ],
  },
  {
    code: "STEM_CELL_DEVELOPMENT",
    name: { zh: "干细胞、类器官与发育模型", en: "Stem cells, organoids, and developmental models" },
    description: {
      zh: "覆盖干细胞和类器官培养、分化、药敏与多组学表型的疾病模型研究。",
      en: "Covers stem-cell and organoid culture, differentiation, drug response, and multi-omic phenotyping for disease-model studies.",
    },
    specializedReagents: {
      zh: "定义培养基、基质、分化因子、细胞解离试剂、支原体检测试剂和类器官活力读出体系。",
      en: "Defined media, matrix, differentiation factors, dissociation reagents, mycoplasma testing, and organoid-viability readout chemistry.",
    },
    targetRequirements: {
      zh: "定义谱系身份、成熟度与功能标志物，并为每个模型预设形态、活率和批次放行阈值。",
      en: "Define lineage identity, maturity, and functional markers and prespecify morphology, viability, and batch-release thresholds for each model.",
    },
    techniqueCodes: ["ORGANOID_CULTURE", "ORGANOID_VIABILITY_ASSAY"],
  },
  {
    code: "EXTRACELLULAR_VESICLES",
    name: { zh: "细胞外囊泡与细胞间通信", en: "Extracellular vesicles and intercellular communication" },
    description: {
      zh: "保留外泌体/细胞外囊泡的分离、粒径计数和蛋白标志物表征，同时与更广的整合生物学领域并列展示。",
      en: "Retains extracellular-vesicle isolation, sizing/counting, and protein-marker characterization while presenting it alongside broader integrative-biology domains.",
    },
    specializedReagents: {
      zh: "EV分离体系或密度梯度、低蛋白背景培养条件、粒径标准品及经样本类型验证的标志物抗体。",
      en: "EV isolation or density-gradient chemistry, low-protein-background culture conditions, particle-size standards, and sample-type-validated marker antibodies.",
    },
    targetRequirements: {
      zh: "至少定义阳性tetraspanin、胞质/内体标志物和非EV污染标志物，并设置来源细胞或参考制备物对照。",
      en: "Define at least a positive tetraspanin, cytosolic/endosomal marker, and non-EV contamination marker, with source-cell or reference-preparation controls.",
    },
    techniqueCodes: ["EV_DIFFERENTIAL_ULTRACENTRIFUGATION", "NANOPARTICLE_TRACKING_ANALYSIS", "WB"],
  },
];

const integrativeDomainByCode = new Map(
  integrativeBiologyDomains.map((domain) => [domain.code, domain]),
);

export function getIntegrativeBiologyDomain(code?: string | null) {
  return code ? integrativeDomainByCode.get(code as IntegrativeDomainCode) ?? null : null;
}

export function techniqueIntegrativeDomainCodes(techniqueCode: string) {
  return integrativeBiologyDomains
    .filter((domain) => domain.techniqueCodes.includes(techniqueCode))
    .map((domain) => domain.code);
}

export function summarizeIntegrativeBiologyDomains(availableTechniqueCodes: Iterable<string>) {
  const available = new Set(availableTechniqueCodes);
  return integrativeBiologyDomains.map((domain) => ({
    ...domain,
    techniqueCount: domain.techniqueCodes.filter((code) => available.has(code)).length,
  }));
}
