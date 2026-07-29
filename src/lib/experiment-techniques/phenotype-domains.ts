export type PhenotypePathwayCode =
  | "EXOSOME"
  | "AUTOPHAGY"
  | "MITOCHONDRIAL_METABOLISM"
  | "OXIDATIVE_STRESS"
  | "APOPTOSIS_CELL_DEATH"
  | "CELL_CYCLE_PROLIFERATION"
  | "CELLULAR_SENESCENCE"
  | "DNA_DAMAGE_RESPONSE"
  | "EMT_MIGRATION_INVASION"
  | "ER_STRESS_PROTEOSTASIS"
  | "ECM_REMODELING"
  | "HYPOXIA_ANGIOGENESIS"
  | "EPITHELIAL_BARRIER"
  | "STEMNESS_DIFFERENTIATION"
  | "TUMOR_MICROENVIRONMENT"
  | "TGF_BETA_SMAD_SIGNALING"
  | "WNT_BETA_CATENIN_SIGNALING"
  | "PI3K_AKT_MTOR_SIGNALING"
  | "MAPK_ERK_SIGNALING"
  | "NF_KAPPA_B_INFLAMMATION"
  | "CALCIUM_SIGNALING"
  | "GLUCOSE_METABOLISM"
  | "LIPID_METABOLISM"
  | "FERROPTOSIS"
  | "NECROPTOSIS"
  | "LYSOSOMAL_FUNCTION"
  | "CELL_ADHESION_CYTOSKELETON"
  | "CIRCADIAN_RHYTHM"
  | "EPIGENETIC_REPROGRAMMING"
  | "DNA_METHYLATION_HYDROXYMETHYLATION"
  | "HISTONE_ACETYLATION"
  | "HISTONE_METHYLATION"
  | "HISTONE_LACTYLATION"
  | "CHROMATIN_ACCESSIBILITY_ARCHITECTURE"
  | "PROTEIN_PHOSPHORYLATION_KINASE_SIGNALING"
  | "NOTCH_HEDGEHOG_SIGNALING"
  | "INFLAMMASOME"
  | "T_CELL_ACTIVATION_EXHAUSTION"
  | "B_CELL_HUMORAL_IMMUNITY"
  | "NK_CELL_CYTOTOXICITY"
  | "MYELOID_INNATE_IMMUNITY"
  | "CHECKPOINT_IMMUNITY"
  | "IMMUNE_METABOLISM"
  | "ANTIGEN_PRESENTATION"
  | "COMPLEMENT_FC_EFFECTOR"
  | "IMMUNE_TRAFFICKING";

export type PhenotypePathwayCategory =
  | "CELLULAR_PROCESS"
  | "TISSUE_MICROENVIRONMENT"
  | "IMMUNE";

type Localized = { zh: string; en: string };

export type PhenotypePathwayDomain = {
  code: PhenotypePathwayCode;
  category: PhenotypePathwayCategory;
  name: Localized;
  description: Localized;
  specializedReagents: Localized;
  targetRequirements: Localized;
  targetPanel: {
    mechanistic: readonly string[];
    readout: readonly string[];
    controls: readonly string[];
  };
  reagentRequirements: readonly {
    role: Localized;
    level: "REQUIRED" | "RECOMMENDED";
    items: readonly Localized[];
  }[];
  techniqueCodes: readonly string[];
};

const localized = (zh: string, en: string): Localized => ({ zh, en });

const required = (role: Localized, ...items: Localized[]) => ({
  role,
  level: "REQUIRED" as const,
  items,
});

const recommended = (role: Localized, ...items: Localized[]) => ({
  role,
  level: "RECOMMENDED" as const,
  items,
});

const primaryReadout = localized("核心读出试剂", "Core readout reagents");
const perturbation = localized("机制扰动试剂", "Mechanistic perturbation reagents");
const qualityControls = localized("质量控制与排除对照", "Quality controls and exclusion controls");

// Broad pathway topics that recur across disease models, cell types, and
// intervention studies.  They deliberately emphasize orthogonal readouts and
// controls over a single marker or vendor-specific kit.
const expandedCommonPathwayDomains: readonly PhenotypePathwayDomain[] = [
  {
    code: "TGF_BETA_SMAD_SIGNALING", category: "TISSUE_MICROENVIRONMENT",
    name: localized("TGF-β/SMAD 信号与纤维化", "TGF-β/SMAD signaling and fibrosis"),
    description: localized("连接配体刺激、SMAD 核转位、ECM 合成与组织纤维化表型。", "Connects ligand stimulation, SMAD nuclear translocation, ECM synthesis, and fibrotic phenotype."),
    specializedReagents: localized("重组 TGF-β、TGFBR/ALK5 抑制剂、p-SMAD2/3 抗体和胶原检测体系。", "Recombinant TGF-β, TGFBR/ALK5 inhibitor, p-SMAD2/3 antibodies, and collagen assays."),
    targetRequirements: localized("同时证明受体近端 SMAD 激活、下游 ECM/转录响应和阻断可逆性。", "Establish proximal SMAD activation, downstream ECM/transcriptional response, and reversibility with blockade."),
    targetPanel: { mechanistic: ["TGFB1", "TGFBR1/ALK5", "SMAD2/3", "SMAD4"], readout: ["p-SMAD2/3", "COL1A1", "FN1", "ACTA2/α-SMA"], controls: ["载体对照", "ALK5 抑制剂", "时间梯度"] },
    reagentRequirements: [
      required(primaryReadout, localized("p-SMAD2/3 与 ECM 抗体", "p-SMAD2/3 and ECM antibodies"), localized("COL1A1/FN1 qPCR 引物", "COL1A1/FN1 qPCR primers")),
      required(perturbation, localized("重组 TGF-β 与 ALK5/TGFBR 抑制剂", "Recombinant TGF-β and ALK5/TGFBR inhibitor")),
      required(qualityControls, localized("未处理、载体和阻断对照", "Untreated, vehicle, and blockade controls")),
    ],
    techniqueCodes: ["WB", "RT_QPCR", "IF", "DUAL_LUCIFERASE_REPORTER"],
  },
  {
    code: "WNT_BETA_CATENIN_SIGNALING", category: "CELLULAR_PROCESS",
    name: localized("WNT/β-catenin 信号", "WNT/β-catenin signaling"),
    description: localized("适用于干性、分化、再生和肿瘤生长中 WNT 配体、受体及转录输出的评估。", "Assesses WNT ligands, receptors, and transcriptional output in stemness, differentiation, regeneration, and tumor growth."),
    specializedReagents: localized("WNT3A 或 GSK3β 抑制剂、Porcupine 抑制剂、β-catenin 抗体和 TCF/LEF 报告系统。", "WNT3A or GSK3β inhibitor, porcupine inhibitor, β-catenin antibody, and TCF/LEF reporter."),
    targetRequirements: localized("将 β-catenin 稳定/核定位与 TCF/LEF 靶基因或功能性干性读出配对。", "Pair β-catenin stabilization/nuclear localization with TCF/LEF targets or functional stemness readout."),
    targetPanel: { mechanistic: ["WNT3A", "FZD", "LRP5/6", "CTNNB1/β-catenin"], readout: ["核 β-catenin", "AXIN2", "MYC", "TCF/LEF 报告"], controls: ["WNT 配体对照", "Porcupine/GSK3β 调节", "无报告载体"] },
    reagentRequirements: [
      required(primaryReadout, localized("β-catenin 抗体与 AXIN2/MYC 引物", "β-catenin antibody and AXIN2/MYC primers"), localized("TCF/LEF 报告质粒", "TCF/LEF reporter plasmid")),
      required(perturbation, localized("WNT3A 或 GSK3β 抑制剂", "WNT3A or GSK3β inhibitor"), localized("Porcupine 抑制剂", "Porcupine inhibitor")),
      required(qualityControls, localized("空载体与核定位定量控制", "Empty-vector and nuclear-localization controls")),
    ],
    techniqueCodes: ["WB", "IF", "RT_QPCR", "DUAL_LUCIFERASE_REPORTER"],
  },
  {
    code: "PI3K_AKT_MTOR_SIGNALING", category: "CELLULAR_PROCESS",
    name: localized("PI3K–AKT–mTOR 生长信号", "PI3K–AKT–mTOR growth signaling"),
    description: localized("评估生长因子、营养与遗传扰动如何经 PI3K–AKT–mTOR 轴影响生长和代谢。", "Assesses how growth factors, nutrients, and genetic perturbations affect growth and metabolism through PI3K–AKT–mTOR."),
    specializedReagents: localized("PI3K/AKT/mTOR 抑制剂、p-AKT/p-S6/p-4EBP1 抗体和生长因子刺激物。", "PI3K/AKT/mTOR inhibitors, p-AKT/p-S6/p-4EBP1 antibodies, and growth-factor stimuli."),
    targetRequirements: localized("用至少两个磷酸化节点和细胞生长/蛋白合成读出避免把单一 p-AKT 作为通路结论。", "Use at least two phospho-nodes plus cell-growth/protein-synthesis readout instead of a single p-AKT measurement."),
    targetPanel: { mechanistic: ["PIK3CA", "AKT1", "MTOR", "TSC1/2"], readout: ["p-AKT", "p-S6", "p-4EBP1", "细胞生长"], controls: ["血清饥饿", "PI3K/AKT/mTOR 抑制剂", "刺激时间梯度"] },
    reagentRequirements: [
      required(primaryReadout, localized("p-AKT、p-S6、p-4EBP1 抗体", "p-AKT, p-S6, and p-4EBP1 antibodies")),
      required(perturbation, localized("PI3K、AKT 或 mTOR 抑制剂", "PI3K, AKT, or mTOR inhibitor"), localized("生长因子或血清刺激", "Growth-factor or serum stimulus")),
      required(qualityControls, localized("总蛋白与细胞活性/数目归一化", "Total-protein and viability/cell-number normalization")),
    ],
    techniqueCodes: ["WB", "PHOSPHO_FLOW", "RT_QPCR", "SEAHORSE_OCR_ECAR"],
  },
  {
    code: "MAPK_ERK_SIGNALING", category: "CELLULAR_PROCESS",
    name: localized("MAPK/ERK 应激与增殖信号", "MAPK/ERK stress and proliferation signaling"),
    description: localized("覆盖 ERK、JNK、p38 分支在增殖、分化和应激适应中的时间依赖激活。", "Covers time-dependent ERK, JNK, and p38 activation in proliferation, differentiation, and stress adaptation."),
    specializedReagents: localized("MEK/ERK、JNK、p38 抑制剂，磷酸化抗体和生长因子/应激刺激物。", "MEK/ERK, JNK, and p38 inhibitors, phospho-antibodies, and growth-factor/stress stimuli."),
    targetRequirements: localized("采用早期磷酸化时间序列并区分 ERK、JNK 与 p38 分支的功能结果。", "Use an early phospho-time course and distinguish functional consequences of ERK, JNK, and p38 branches."),
    targetPanel: { mechanistic: ["MAP2K1/MEK", "MAPK1/3/ERK", "MAPK8/JNK", "MAPK14/p38"], readout: ["p-ERK", "p-JNK", "p-p38", "AP-1/增殖响应"], controls: ["MEK/JNK/p38 抑制剂", "载体对照", "采样时间梯度"] },
    reagentRequirements: [
      required(primaryReadout, localized("p-ERK、p-JNK、p-p38 抗体", "p-ERK, p-JNK, and p-p38 antibodies")),
      required(perturbation, localized("MEK、JNK 或 p38 选择性抑制剂", "Selective MEK, JNK, or p38 inhibitor")),
      required(qualityControls, localized("总 ERK/JNK/p38 与时间序列对照", "Total ERK/JNK/p38 and time-course controls")),
    ],
    techniqueCodes: ["WB", "PHOSPHO_FLOW", "IF", "DUAL_LUCIFERASE_REPORTER"],
  },
  {
    code: "NF_KAPPA_B_INFLAMMATION", category: "CELLULAR_PROCESS",
    name: localized("NF-κB 炎症信号", "NF-κB inflammatory signaling"),
    description: localized("与炎性小体专题分开，聚焦受体近端 NF-κB 激活及其广泛的炎症转录程序。", "Separate from the inflammasome topic, focusing on proximal NF-κB activation and its broad inflammatory transcriptional program."),
    specializedReagents: localized("TLR/TNF 刺激物、IKK/NF-κB 抑制剂、p65/p-IκBα 抗体和炎症基因引物。", "TLR/TNF stimuli, IKK/NF-κB inhibitors, p65/p-IκBα antibodies, and inflammatory-gene primers."),
    targetRequirements: localized("以 IκBα 降解或 p65 核转位、下游转录本和药理阻断共同判读。", "Interpret using IκBα degradation or p65 nuclear translocation, downstream transcripts, and pharmacologic blockade together."),
    targetPanel: { mechanistic: ["RELA/p65", "NFKBIA/IκBα", "IKK"], readout: ["p65 核转位", "p-IκBα", "IL6", "TNF", "CXCL8"], controls: ["TLR/TNF 刺激", "IKK/NF-κB 抑制剂", "未刺激对照"] },
    reagentRequirements: [
      required(primaryReadout, localized("p65、p-IκBα/IκBα 抗体", "p65 and p-IκBα/IκBα antibodies"), localized("IL6/TNF/CXCL8 引物或定量试剂", "IL6/TNF/CXCL8 primers or quantitation reagent")),
      required(perturbation, localized("TLR 或 TNF 刺激物与 IKK/NF-κB 抑制剂", "TLR or TNF stimulus with IKK/NF-κB inhibitor")),
      required(qualityControls, localized("核/胞质定位和细胞活性控制", "Nuclear/cytoplasmic localization and cell-viability controls")),
    ],
    techniqueCodes: ["WB", "IF", "RT_QPCR", "SANDWICH_ELISA"],
  },
  {
    code: "CALCIUM_SIGNALING", category: "CELLULAR_PROCESS",
    name: localized("钙信号与兴奋-分泌耦联", "Calcium signaling and excitation–secretion coupling"),
    description: localized("解析瞬时钙流、钙库释放和钙依赖效应之间的关系，适用于神经、免疫和分泌细胞。", "Dissects calcium transients, store release, and calcium-dependent effects in neural, immune, and secretory cells."),
    specializedReagents: localized("Ca²⁺ 荧光探针、螯合剂、钙离子载体/受体激动剂和钙依赖蛋白抗体。", "Ca²⁺ fluorescent probes, chelators, ionophore/receptor agonists, and calcium-dependent protein antibodies."),
    targetRequirements: localized("记录单细胞或群体钙动力学、刺激剂量与细胞活性；不可仅以终点荧光强度判断。", "Record single-cell or population calcium kinetics, stimulus dose, and viability; do not use endpoint fluorescence alone."),
    targetPanel: { mechanistic: ["ITPR", "STIM1", "ORAI1", "CAMK2"], readout: ["Ca²⁺ 峰值", "AUC", "响应细胞比例", "钙依赖分泌"], controls: ["无钙/螯合对照", "离子载体阳性对照", "无探针对照"] },
    reagentRequirements: [
      required(primaryReadout, localized("Fluo-4、Fura-2 或同类 Ca²⁺ 探针", "Fluo-4, Fura-2, or comparable Ca²⁺ probe")),
      required(perturbation, localized("Ca²⁺ 螯合剂和离子载体/受体激动剂", "Ca²⁺ chelator and ionophore/receptor agonist")),
      required(qualityControls, localized("无钙、无探针和活细胞控制", "Calcium-free, no-probe, and live-cell controls")),
    ],
    techniqueCodes: ["CALCIUM_FLUX_ASSAY", "FLOW", "CONFOCAL_LSM"],
  },
  {
    code: "GLUCOSE_METABOLISM", category: "CELLULAR_PROCESS",
    name: localized("葡萄糖代谢与糖酵解", "Glucose metabolism and glycolysis"),
    description: localized("覆盖葡萄糖摄取、糖酵解通量、乳酸释放和与线粒体呼吸的代偿关系。", "Covers glucose uptake, glycolytic flux, lactate release, and compensation with mitochondrial respiration."),
    specializedReagents: localized("葡萄糖摄取探针、糖酵解/乳酸检测试剂、2-DG 或糖酵解抑制剂和稳定同位素示踪底物。", "Glucose-uptake probes, glycolysis/lactate assays, 2-DG or glycolysis inhibitors, and stable-isotope tracers."),
    targetRequirements: localized("将摄取、ECAR/乳酸和细胞数归一化一起报告，明确培养基葡萄糖浓度。", "Report uptake, ECAR/lactate, and cell-number normalization together and specify medium glucose concentration."),
    targetPanel: { mechanistic: ["SLC2A1/GLUT1", "HK2", "PFKFB3", "LDHA"], readout: ["葡萄糖摄取", "ECAR", "乳酸", "糖酵解基因"], controls: ["无葡萄糖/竞争抑制", "2-DG", "细胞数归一化"] },
    reagentRequirements: [
      required(primaryReadout, localized("2-NBDG 或葡萄糖摄取探针", "2-NBDG or glucose-uptake probe"), localized("乳酸或 ECAR 检测体系", "Lactate or ECAR assay system")),
      required(perturbation, localized("2-DG 或糖酵解抑制剂", "2-DG or glycolysis inhibitor")),
      required(qualityControls, localized("培养基葡萄糖记录和细胞数归一化", "Medium-glucose record and cell-number normalization")),
    ],
    techniqueCodes: ["SEAHORSE_OCR_ECAR", "FLOW", "RT_QPCR"],
  },
  {
    code: "LIPID_METABOLISM", category: "CELLULAR_PROCESS",
    name: localized("脂质代谢与脂滴表型", "Lipid metabolism and lipid-droplet phenotypes"),
    description: localized("覆盖脂肪酸摄取/氧化、脂滴积累、脂质合成和脂质分子种变化。", "Covers fatty-acid uptake/oxidation, lipid-droplet accumulation, lipogenesis, and lipid-species changes."),
    specializedReagents: localized("脂滴/脂肪酸探针、脂质提取与内标、脂肪酸氧化抑制剂和脂质组质谱试剂。", "Lipid-droplet/fatty-acid probes, lipid extraction/internal standards, fatty-acid-oxidation inhibitors, and lipidomics MS reagents."),
    targetRequirements: localized("区分脂滴储存、脂肪酸氧化和膜脂重塑，结合总脂质/细胞数归一化。", "Distinguish lipid-droplet storage, fatty-acid oxidation, and membrane-lipid remodeling with total-lipid/cell-number normalization."),
    targetPanel: { mechanistic: ["SREBF1", "FASN", "ACACA", "CPT1A", "PPARA"], readout: ["脂滴面积", "脂肪酸摄取", "脂质分子种", "β-氧化"], controls: ["脂肪酸负荷", "CPT1 抑制", "无染料/内标空白"] },
    reagentRequirements: [
      required(primaryReadout, localized("BODIPY/Nile Red 脂滴或脂肪酸探针", "BODIPY/Nile Red lipid-droplet or fatty-acid probe"), localized("脂质提取剂与内标", "Lipid extraction reagents and internal standards")),
      required(perturbation, localized("脂肪酸负荷与脂肪酸氧化抑制剂", "Fatty-acid loading and fatty-acid-oxidation inhibitor")),
      required(qualityControls, localized("无染料、提取空白和细胞数归一化", "No-dye, extraction-blank, and cell-number normalization")),
    ],
    techniqueCodes: ["LC_MS_LIPIDOMICS", "FLOW", "SEAHORSE_OCR_ECAR"],
  },
  {
    code: "FERROPTOSIS", category: "CELLULAR_PROCESS",
    name: localized("铁死亡", "Ferroptosis"),
    description: localized("以铁依赖脂质过氧化和特异性救援来区分铁死亡与一般氧化损伤或凋亡。", "Distinguishes ferroptosis from general oxidative injury or apoptosis through iron-dependent lipid peroxidation and specific rescue."),
    specializedReagents: localized("铁死亡诱导剂、Ferrostatin-1/Liproxstatin-1、铁螯合剂、脂质过氧化探针和 GPX4 抗体。", "Ferroptosis inducers, ferrostatin-1/liproxstatin-1, iron chelator, lipid-peroxidation probe, and GPX4 antibody."),
    targetRequirements: localized("需同时证明脂质 ROS、铁依赖性及 ferroptosis 特异救援，并排除 caspase 依赖凋亡。", "Demonstrate lipid ROS, iron dependence, and ferroptosis-specific rescue together while excluding caspase-dependent apoptosis."),
    targetPanel: { mechanistic: ["GPX4", "SLC7A11", "ACSL4", "TFRC"], readout: ["脂质 ROS", "细胞死亡", "GPX4 水平"], controls: ["Ferrostatin-1/Liproxstatin-1", "Deferoxamine", "caspase 抑制剂对照"] },
    reagentRequirements: [
      required(primaryReadout, localized("C11-BODIPY 脂质过氧化探针", "C11-BODIPY lipid-peroxidation probe"), localized("GPX4/SLC7A11/ACSL4 抗体", "GPX4/SLC7A11/ACSL4 antibodies")),
      required(perturbation, localized("铁死亡诱导剂与 Ferrostatin-1/Liproxstatin-1", "Ferroptosis inducer and ferrostatin-1/liproxstatin-1"), localized("铁螯合剂", "Iron chelator")),
      required(qualityControls, localized("活死读出和凋亡排除对照", "Viability/death readout and apoptosis-exclusion controls")),
    ],
    techniqueCodes: ["FLOW", "WB", "LDH_RELEASE_ASSAY"],
  },
  {
    code: "NECROPTOSIS", category: "CELLULAR_PROCESS",
    name: localized("程序性坏死", "Necroptosis"),
    description: localized("通过 RIPK1/RIPK3/MLKL 轴的磷酸化、膜破裂和通路抑制剂救援界定程序性坏死。", "Defines necroptosis through RIPK1/RIPK3/MLKL-axis phosphorylation, membrane rupture, and rescue by pathway inhibitors."),
    specializedReagents: localized("TNF 诱导体系、caspase 抑制剂、RIPK1/RIPK3/MLKL 抑制剂和 p-MLKL 抗体。", "TNF induction system, caspase inhibitor, RIPK1/RIPK3/MLKL inhibitors, and p-MLKL antibody."),
    targetRequirements: localized("将 p-MLKL、膜完整性丧失和 Nec-1s 等救援联系起来，避免只以 LDH 判断死亡方式。", "Link p-MLKL, membrane-integrity loss, and rescue such as Nec-1s; do not use LDH alone to call a death modality."),
    targetPanel: { mechanistic: ["RIPK1", "RIPK3", "MLKL"], readout: ["p-MLKL", "膜通透性", "LDH 释放"], controls: ["Nec-1s", "RIPK3/MLKL 抑制", "凋亡对照"] },
    reagentRequirements: [
      required(primaryReadout, localized("p-MLKL、RIPK1/RIPK3 抗体", "p-MLKL and RIPK1/RIPK3 antibodies"), localized("膜完整性或 LDH 读出", "Membrane-integrity or LDH readout")),
      required(perturbation, localized("TNF 诱导组合与 Nec-1s/RIPK3/MLKL 抑制剂", "TNF induction combination with Nec-1s/RIPK3/MLKL inhibitor")),
      required(qualityControls, localized("凋亡和未处理对照", "Apoptosis and untreated controls")),
    ],
    techniqueCodes: ["WB", "FLOW", "LDH_RELEASE_ASSAY"],
  },
  {
    code: "LYSOSOMAL_FUNCTION", category: "CELLULAR_PROCESS",
    name: localized("溶酶体功能与胞内降解", "Lysosomal function and intracellular degradation"),
    description: localized("覆盖溶酶体酸化、蛋白酶活性、货物降解和与自噬/代谢的耦联。", "Covers lysosomal acidification, protease activity, cargo degradation, and coupling to autophagy/metabolism."),
    specializedReagents: localized("LysoTracker/LysoSensor、cathepsin 活性底物、酸化抑制剂和 LAMP1/2 抗体。", "LysoTracker/LysoSensor, cathepsin activity substrates, acidification inhibitors, and LAMP1/2 antibodies."),
    targetRequirements: localized("将酸化、酶活与降解通量配对，并区分溶酶体数量增加和功能增强。", "Pair acidification, enzyme activity, and degradative flux, distinguishing increased lysosome number from increased function."),
    targetPanel: { mechanistic: ["LAMP1", "LAMP2", "CTSB", "CTSD", "TFEB"], readout: ["酸化", "cathepsin 活性", "货物降解", "TFEB 定位"], controls: ["Bafilomycin A1", "Chloroquine", "无底物/无探针对照"] },
    reagentRequirements: [
      required(primaryReadout, localized("LysoTracker/LysoSensor 与 cathepsin 活性底物", "LysoTracker/LysoSensor and cathepsin activity substrate"), localized("LAMP1/2、CTSB/CTSD 抗体", "LAMP1/2 and CTSB/CTSD antibodies")),
      required(perturbation, localized("溶酶体酸化抑制剂", "Lysosomal-acidification inhibitor")),
      required(qualityControls, localized("无探针、无底物和活细胞控制", "No-probe, no-substrate, and live-cell controls")),
    ],
    techniqueCodes: ["IF", "FLOW", "WB"],
  },
  {
    code: "CELL_ADHESION_CYTOSKELETON", category: "TISSUE_MICROENVIRONMENT",
    name: localized("细胞黏附、骨架与力学转导", "Cell adhesion, cytoskeleton, and mechanotransduction"),
    description: localized("连接整合素-黏着斑-肌动蛋白张力与细胞迁移、屏障和分化等表型。", "Connects integrin–focal adhesion–actin tension to migration, barrier, and differentiation phenotypes."),
    specializedReagents: localized("ECM 包被材料、黏附板、F-actin 染料、整合素/FAK/YAP 抗体和收缩抑制剂。", "ECM coatings, adhesion plates, F-actin dye, integrin/FAK/YAP antibodies, and contractility inhibitors."),
    targetRequirements: localized("同时评估黏附功能、骨架组织和 FAK/YAP 等力学信号，控制基质硬度与包被批次。", "Assess adhesion function, cytoskeletal organization, and FAK/YAP mechanosignaling together, controlling matrix stiffness and coating batch."),
    targetPanel: { mechanistic: ["ITGB1", "PTK2/FAK", "VCL", "YAP1/TAZ"], readout: ["黏附细胞数", "F-actin 应力纤维", "p-FAK", "YAP 核定位"], controls: ["无包被表面", "FAK/ROCK 抑制", "基质硬度/批次控制"] },
    reagentRequirements: [
      required(primaryReadout, localized("胶原/纤连蛋白包被与细胞黏附板", "Collagen/fibronectin coating and cell-adhesion plate"), localized("F-actin 染料与 ITGB1/FAK/YAP 抗体", "F-actin dye and ITGB1/FAK/YAP antibodies")),
      required(perturbation, localized("FAK 或 ROCK 抑制剂", "FAK or ROCK inhibitor")),
      required(qualityControls, localized("无包被、基质批次和细胞数控制", "Uncoated-surface, matrix-batch, and cell-number controls")),
    ],
    techniqueCodes: ["CELL_ADHESION_ASSAY", "IF", "WB"],
  },
  {
    code: "CIRCADIAN_RHYTHM", category: "CELLULAR_PROCESS",
    name: localized("昼夜节律与时间生物学", "Circadian rhythm and chronobiology"),
    description: localized("解析核心时钟、节律性转录/代谢和干预时间对细胞或组织表型的影响。", "Dissects core clocks, rhythmic transcription/metabolism, and timing of interventions in cellular or tissue phenotypes."),
    specializedReagents: localized("时钟同步剂、时间分辨采样耗材、BMAL1/CLOCK/PER/CRY 引物/抗体和节律报告系统。", "Clock synchronizers, time-resolved sampling supplies, BMAL1/CLOCK/PER/CRY primers/antibodies, and rhythmic reporters."),
    targetRequirements: localized("采用跨至少一个完整周期的时间序列，并将培养基更换、细胞密度和处理时点标准化。", "Use a time series spanning at least one full cycle and standardize media changes, cell density, and treatment timing."),
    targetPanel: { mechanistic: ["ARNTL/BMAL1", "CLOCK", "PER1/2", "CRY1/2"], readout: ["时钟基因振荡", "节律报告", "周期/相位", "节律性代谢读出"], controls: ["同步与未同步", "时间匹配载体", "采样时钟校准"] },
    reagentRequirements: [
      required(primaryReadout, localized("BMAL1/CLOCK/PER/CRY 引物或抗体", "BMAL1/CLOCK/PER/CRY primers or antibodies"), localized("节律性荧光素酶报告系统", "Rhythmic luciferase reporter system")),
      required(perturbation, localized("血清冲击或糖皮质激素同步剂", "Serum-shock or glucocorticoid synchronizer")),
      required(qualityControls, localized("时间分辨采样、未同步和时间匹配对照", "Time-resolved sampling, unsynchronized, and time-matched controls")),
    ],
    techniqueCodes: ["RT_QPCR", "WB", "DUAL_LUCIFERASE_REPORTER"],
  },
  {
    code: "EPIGENETIC_REPROGRAMMING", category: "CELLULAR_PROCESS",
    name: localized("表观遗传重编程", "Epigenetic reprogramming"),
    description: localized("连接 DNA 甲基化、组蛋白修饰、染色质可及性与稳定的细胞状态转换。", "Connects DNA methylation, histone modifications, chromatin accessibility, and stable cell-state transitions."),
    specializedReagents: localized("经验证的组蛋白修饰抗体、染色质/甲基化试剂、表观遗传抑制剂和位点特异引物/探针。", "Validated histone-mark antibodies, chromatin/methylation reagents, epigenetic inhibitors, and locus-specific primers/probes."),
    targetRequirements: localized("明确候选位点或基因集，并以表达、可及性或甲基化中的至少两种正交层级支持重编程结论。", "Define candidate loci or gene set and support reprogramming with at least two orthogonal layers among expression, accessibility, and methylation."),
    targetPanel: { mechanistic: ["DNMT1", "TET", "EZH2", "HDAC"], readout: ["H3K27ac/H3K27me3", "DNA 甲基化", "ATAC 可及性", "表达转换"], controls: ["IgG/Input", "抑制剂或遗传扰动", "阴性位点"] },
    reagentRequirements: [
      required(primaryReadout, localized("组蛋白修饰抗体与 ChIP/CUT 试剂", "Histone-mark antibodies and ChIP/CUT reagents"), localized("目标/阴性位点 qPCR 引物", "Target/negative-locus qPCR primers")),
      required(perturbation, localized("DNMT、HDAC 或 EZH2 调节剂", "DNMT, HDAC, or EZH2 modulator")),
      required(qualityControls, localized("Input、IgG 和阴性位点控制", "Input, IgG, and negative-locus controls")),
    ],
    techniqueCodes: ["CHIP_QPCR", "ATAC_QPCR", "RT_QPCR"],
  },
  {
    code: "DNA_METHYLATION_HYDROXYMETHYLATION", category: "CELLULAR_PROCESS",
    name: localized("DNA甲基化与羟甲基化", "DNA methylation and hydroxymethylation"),
    description: localized("独立解析 5mC/5hmC 重塑、CpG 位点状态及其与转录输出的关系。", "Independently resolves 5mC/5hmC remodeling, CpG-locus state, and its relationship to transcriptional output."),
    specializedReagents: localized("亚硫酸氢盐转换体系、5mC/5hmC 抗体或探针、甲基化标准物和 DNMT/TET 调节剂。", "Bisulfite-conversion chemistry, 5mC/5hmC antibodies or probes, methylation standards, and DNMT/TET modulators."),
    targetRequirements: localized("明确目标 CpG/区域，记录转换效率；用甲基化与未甲基化参考物，并区分 5mC 与 5hmC。", "Define target CpGs/regions, record conversion efficiency, use methylated/unmethylated references, and distinguish 5mC from 5hmC."),
    targetPanel: { mechanistic: ["DNMT1", "DNMT3A/3B", "TET1/2/3"], readout: ["5mC", "5hmC", "差异CpG", "甲基化-表达关联"], controls: ["甲基化/未甲基化标准", "转换效率", "细胞组成校正"] },
    reagentRequirements: [
      required(primaryReadout, localized("亚硫酸氢盐转换试剂与 5mC/5hmC 检测体系", "Bisulfite-conversion reagent and 5mC/5hmC detection system"), localized("目标区域引物/探针", "Target-region primers/probes")),
      required(perturbation, localized("DNMT 或 TET 调节剂（如适用）", "DNMT or TET modulator when applicable")),
      required(qualityControls, localized("甲基化/未甲基化参考物与转换效率控制", "Methylated/unmethylated references and conversion-efficiency control")),
    ],
    techniqueCodes: ["WHOLE_GENOME_BISULFITE_SEQUENCING", "DNA_METHYLATION_ARRAY", "CHIP_QPCR", "RT_QPCR"],
  },
  {
    code: "HISTONE_ACETYLATION", category: "CELLULAR_PROCESS",
    name: localized("组蛋白乙酰化", "Histone acetylation"),
    description: localized("聚焦 HAT/HDAC 平衡、增强子/启动子乙酰化和转录激活状态。", "Focuses on HAT/HDAC balance, enhancer/promoter acetylation, and transcriptionally active state."),
    specializedReagents: localized("ChIP/CUT 验证的 H3K27ac/H3K9ac 抗体、HDAC/HAT 调节剂、Protein A/G 磁珠和位点引物。", "ChIP/CUT-validated H3K27ac/H3K9ac antibodies, HDAC/HAT modulators, Protein A/G beads, and locus primers."),
    targetRequirements: localized("将全局乙酰化与候选调控位点富集区分，并以 Input、IgG、阴性位点和转录输出联合验证。", "Separate global acetylation from candidate regulatory-locus enrichment and validate with Input, IgG, negative loci, and transcriptional output."),
    targetPanel: { mechanistic: ["EP300/p300", "CREBBP/CBP", "HDAC1/2", "KAT2A"], readout: ["H3K27ac", "H3K9ac", "位点富集", "靶基因表达"], controls: ["Input/IgG", "阴性位点", "HDAC/HAT 抑制或激活"] },
    reagentRequirements: [
      required(primaryReadout, localized("H3K27ac/H3K9ac ChIP/CUT 验证抗体", "H3K27ac/H3K9ac ChIP/CUT-validated antibodies"), localized("目标和阴性位点引物", "Target and negative-locus primers")),
      required(perturbation, localized("HDAC 抑制剂或 HAT 调节剂", "HDAC inhibitor or HAT modulator")),
      required(qualityControls, localized("Input、IgG、抗体滴定与细胞活性控制", "Input, IgG, antibody-titration, and viability controls")),
    ],
    techniqueCodes: ["CHIP_QPCR", "CUT_AND_TAG", "WB", "IF"],
  },
  {
    code: "HISTONE_METHYLATION", category: "CELLULAR_PROCESS",
    name: localized("组蛋白甲基化", "Histone methylation"),
    description: localized("解析激活性与抑制性组蛋白甲基化标记、甲基转移酶/去甲基化酶和染色质状态。", "Dissects activating/repressive histone methylation marks, methyltransferases/demethylases, and chromatin state."),
    specializedReagents: localized("H3K4me3、H3K27me3、H3K9me3 抗体、EZH2/KDM 调节剂和 ChIP/CUT 试剂。", "H3K4me3, H3K27me3, H3K9me3 antibodies, EZH2/KDM modulators, and ChIP/CUT reagents."),
    targetRequirements: localized("把标记、位点、相关酶和基因表达一起解释；避免仅凭全局 WB 判断基因座调控。", "Interpret marks, loci, relevant enzymes, and gene expression together; do not infer locus regulation from global WB alone."),
    targetPanel: { mechanistic: ["EZH2", "KMT2", "SUV39H1", "KDM6A/B"], readout: ["H3K4me3", "H3K27me3", "H3K9me3", "位点富集"], controls: ["Input/IgG", "阴性位点", "酶抑制/遗传扰动"] },
    reagentRequirements: [
      required(primaryReadout, localized("H3K4me3/H3K27me3/H3K9me3 验证抗体", "Validated H3K4me3/H3K27me3/H3K9me3 antibodies"), localized("目标和阴性位点引物", "Target and negative-locus primers")),
      required(perturbation, localized("EZH2 或 KDM 调节剂", "EZH2 or KDM modulator")),
      required(qualityControls, localized("Input、IgG、抗体特异性和细胞状态控制", "Input, IgG, antibody-specificity, and cell-state controls")),
    ],
    techniqueCodes: ["CHIP_QPCR", "CUT_AND_RUN", "WB", "IF"],
  },
  {
    code: "HISTONE_LACTYLATION", category: "CELLULAR_PROCESS",
    name: localized("组蛋白乳酸化", "Histone lactylation"),
    description: localized("研究乳酸积累与组蛋白赖氨酸乳酸化在代谢-表观遗传耦联和状态转换中的作用。", "Studies how lactate accumulation and histone lysine lactylation couple metabolism to epigenetics and state transitions."),
    specializedReagents: localized("泛赖氨酸乳酸化或 H3K18la 抗体、乳酸/糖酵解调节剂、乳酸定量体系和 ChIP/CUT 试剂。", "Pan-lysine-lactylation or H3K18la antibody, lactate/glycolysis modulators, lactate assay, and ChIP/CUT reagents."),
    targetRequirements: localized("同时证明乳酸负荷、乳酸化标记、候选位点/基因表达和可逆性，并控制培养基 pH 与渗透压。", "Demonstrate lactate load, lactylation mark, candidate loci/gene expression, and reversibility together while controlling medium pH and osmolality."),
    targetPanel: { mechanistic: ["LDHA", "MCT1/SLC16A1", "EP300/p300"], readout: ["Pan-Kla", "H3K18la", "乳酸浓度", "候选位点富集"], controls: ["pH/渗透压匹配", "糖酵解或乳酸转运阻断", "抗原肽竞争/抗体特异性"] },
    reagentRequirements: [
      required(primaryReadout, localized("Pan-Kla 或 H3K18la 验证抗体", "Validated Pan-Kla or H3K18la antibody"), localized("乳酸定量试剂", "Lactate quantitation reagent")),
      required(perturbation, localized("乳酸盐、糖酵解抑制剂或 MCT 转运抑制剂", "Lactate salt, glycolysis inhibitor, or MCT-transport inhibitor")),
      required(qualityControls, localized("pH/渗透压匹配、抗原肽竞争和细胞活性控制", "pH/osmolality-matched, competing-peptide, and viability controls")),
    ],
    techniqueCodes: ["WB", "CHIP_QPCR", "IF", "RT_QPCR"],
  },
  {
    code: "CHROMATIN_ACCESSIBILITY_ARCHITECTURE", category: "CELLULAR_PROCESS",
    name: localized("染色质可及性与核内结构", "Chromatin accessibility and nuclear architecture"),
    description: localized("连接开放染色质、转录因子基序、核小体组织及三维基因组接触与细胞状态。", "Connects open chromatin, transcription-factor motifs, nucleosome organization, and 3D genome contacts to cell state."),
    specializedReagents: localized("Tn5 转座酶、细胞核分离体系、ATAC/CUT 建库试剂、质量控制引物和必要的染色质构象试剂。", "Tn5 transposase, nuclei-isolation chemistry, ATAC/CUT library reagents, QC primers, and chromatin-conformation reagents when needed."),
    targetRequirements: localized("预定义细胞/细胞核质量、TSS 富集和片段分布阈值；候选开放区必须结合基因表达或位点验证。", "Predefine cell/nuclei quality, TSS enrichment, and fragment-distribution thresholds; candidate open regions require expression or locus-level confirmation."),
    targetPanel: { mechanistic: ["Tn5 可及性", "转录因子基序", "CTCF", "cohesin"], readout: ["开放峰", "TSS 富集", "核小体周期性", "峰-基因关联"], controls: ["裸 DNA/转座背景", "批次/双细胞控制", "阴性区域"] },
    reagentRequirements: [
      required(primaryReadout, localized("Tn5 转座酶、细胞核分离和 ATAC 建库体系", "Tn5 transposase, nuclei isolation, and ATAC library system"), localized("QC 位点引物", "QC-locus primers")),
      required(qualityControls, localized("细胞核完整性、TSS 富集、双细胞和批次控制", "Nuclei integrity, TSS-enrichment, doublet, and batch controls")),
    ],
    techniqueCodes: ["ATAC_QPCR", "ATAC_SEQUENCING", "SINGLE_CELL_ATAC_SEQUENCING", "CAPTURE_HI_C"],
  },
  {
    code: "PROTEIN_PHOSPHORYLATION_KINASE_SIGNALING", category: "CELLULAR_PROCESS",
    name: localized("蛋白质磷酸化与激酶信号", "Protein phosphorylation and kinase signaling"),
    description: localized("以位点级磷酸化、激酶-底物网络和刺激动力学描述信号状态，而非单个总蛋白变化。", "Describes signaling state through site-level phosphorylation, kinase–substrate networks, and stimulus kinetics rather than one total-protein change."),
    specializedReagents: localized("磷酸化位点验证抗体、磷酸酶/蛋白酶抑制剂、激酶抑制剂、磷酸肽富集材料和标准肽。", "Phosphosite-validated antibodies, phosphatase/protease inhibitors, kinase inhibitors, phosphopeptide enrichment media, and standard peptides."),
    targetRequirements: localized("样本采集后需立即抑制去磷酸化；至少配对总蛋白、刺激时间序列、抑制剂和正交位点验证。", "Immediately inhibit dephosphorylation after sampling; pair total protein, stimulus time course, inhibitor, and orthogonal phosphosite validation."),
    targetPanel: { mechanistic: ["激酶", "磷酸酶", "激酶-底物轴"], readout: ["p-ERK", "p-AKT", "p-STAT", "磷酸肽丰度"], controls: ["磷酸酶抑制", "激酶抑制", "总蛋白归一化", "时间梯度"] },
    reagentRequirements: [
      required(primaryReadout, localized("经位点验证的磷酸化/总蛋白抗体对", "Phosphosite-validated phospho/total-protein antibody pairs"), localized("磷酸肽富集材料或标准肽", "Phosphopeptide-enrichment medium or standard peptides")),
      required(perturbation, localized("与假设匹配的激酶抑制剂/刺激物", "Hypothesis-matched kinase inhibitor/stimulus")),
      required(qualityControls, localized("磷酸酶抑制、时间梯度和样本即刻淬灭控制", "Phosphatase inhibition, time-course, and immediate-quench controls")),
    ],
    techniqueCodes: ["PHOSPHOPROTEOMICS", "WB", "PHOSPHO_FLOW", "TARGETED_LC_MS_MS_QUANTIFICATION"],
  },
  {
    code: "NOTCH_HEDGEHOG_SIGNALING", category: "CELLULAR_PROCESS",
    name: localized("Notch/Hedgehog 发育信号", "Notch/Hedgehog developmental signaling"),
    description: localized("用于发育、再生、干细胞维持和肿瘤分化中 Notch 与 Hedgehog 通路的可逆性研究。", "Supports reversible study of Notch and Hedgehog pathways in development, regeneration, stem-cell maintenance, and tumor differentiation."),
    specializedReagents: localized("Notch 配体或 γ-secretase 抑制剂、Sonic hedgehog/SMO 调节剂和 NICD/GLI 抗体或引物。", "Notch ligand or γ-secretase inhibitor, Sonic hedgehog/SMO modulator, and NICD/GLI antibodies or primers."),
    targetRequirements: localized("预先区分 Notch 与 Hedgehog 分支，并以转录输出和谱系/功能读出支持通路活动。", "Prespecify Notch versus Hedgehog branch and support activity with transcriptional output plus lineage/functional readout."),
    targetPanel: { mechanistic: ["NOTCH1", "NICD", "JAG1", "SMO", "GLI1"], readout: ["HES1/HEY1", "GLI1/PTCH1", "分化标志", "类器官形成"], controls: ["γ-secretase 抑制", "SMO 抑制/激动", "载体对照"] },
    reagentRequirements: [
      required(primaryReadout, localized("NICD/GLI 抗体与 HES1/GLI1/PTCH1 引物", "NICD/GLI antibodies and HES1/GLI1/PTCH1 primers")),
      required(perturbation, localized("γ-secretase 与 SMO 调节剂", "γ-secretase and SMO modulators")),
      required(qualityControls, localized("分支特异阻断、载体和谱系读出对照", "Branch-specific blockade, vehicle, and lineage-readout controls")),
    ],
    techniqueCodes: ["WB", "RT_QPCR", "IF", "ORGANOID_CULTURE"],
  },
];

/**
 * Research-facing phenotypes and pathways.  A topic represents the biological
 * question (rather than a sequencing or instrument platform), so one topic can
 * intentionally point to multiple orthogonal techniques.
 */
export const phenotypePathwayDomains: readonly PhenotypePathwayDomain[] = [
  {
    code: "EXOSOME",
    category: "CELLULAR_PROCESS",
    name: localized("外泌体与细胞外囊泡", "Exosomes and extracellular vesicles"),
    description: localized(
      "以分离纯度、颗粒特征和标志物组合为核心，研究细胞外囊泡介导的细胞间通信。",
      "Studies extracellular-vesicle-mediated communication through isolation purity, particle features, and marker combinations.",
    ),
    specializedReagents: localized(
      "低背景培养条件、EV分离体系、粒径/计数标准和经样本验证的抗体组合。",
      "Low-background culture conditions, EV isolation chemistry, particle standards, and sample-validated marker panels.",
    ),
    targetRequirements: localized(
      "同时预设膜性阳性标志、内体来源标志和非EV污染排除标志；不得只凭单一WB条带定义外泌体。",
      "Prespecify positive membrane, endosomal-origin, and non-EV exclusion markers; never define exosomes with a single WB band.",
    ),
    targetPanel: {
      mechanistic: ["CD9", "CD63", "CD81", "TSG101", "ALIX"],
      readout: ["颗粒浓度", "粒径分布", "标志物富集"],
      controls: ["Calnexin", "GM130", "来源细胞裂解物", "无细胞培养基空白"],
    },
    reagentRequirements: [
      required(primaryReadout, localized("EV分离/富集体系", "EV isolation/enrichment chemistry"), localized("CD9/CD63/CD81与TSG101/ALIX抗体", "CD9/CD63/CD81 and TSG101/ALIX antibodies")),
      required(qualityControls, localized("Calnexin或GM130等非EV污染标志抗体", "Non-EV contamination-marker antibody, e.g. Calnexin or GM130"), localized("粒径/颗粒计数标准品", "Particle sizing/counting standard")),
      recommended(perturbation, localized("分泌抑制或内吞抑制对照", "Secretion or uptake perturbation control")),
    ],
    techniqueCodes: ["EV_DIFFERENTIAL_ULTRACENTRIFUGATION", "NANOPARTICLE_TRACKING_ANALYSIS", "WB"],
  },
  {
    code: "AUTOPHAGY",
    category: "CELLULAR_PROCESS",
    name: localized("自噬通量", "Autophagic flux"),
    description: localized("区分自噬体形成与溶酶体降解阻断，强调动态通量而非静态LC3水平。", "Distinguishes autophagosome formation from blocked lysosomal degradation and prioritizes dynamic flux over static LC3 abundance."),
    specializedReagents: localized("溶酶体抑制剂、诱导/抑制自噬药物、LC3/p62抗体和双荧光通量报告体系。", "Lysosomal inhibitors, autophagy modulators, LC3/p62 antibodies, and dual-fluorescent flux reporters."),
    targetRequirements: localized("至少在有无溶酶体阻断条件下检测LC3-II和SQSTM1/p62，并搭配功能或成像读出。", "Measure LC3-II and SQSTM1/p62 with and without lysosomal blockade and pair them with functional or imaging readouts."),
    targetPanel: { mechanistic: ["MAP1LC3B/LC3B", "SQSTM1/p62", "BECN1", "ATG5"], readout: ["LC3-II累积", "p62周转", "自噬体/自噬溶酶体比值"], controls: ["Bafilomycin A1或Chloroquine阻断", "营养充足对照", "ATG5/ATG7缺失对照"] },
    reagentRequirements: [
      required(primaryReadout, localized("LC3B和SQSTM1/p62验证抗体", "Validated LC3B and SQSTM1/p62 antibodies"), localized("双荧光mCherry-GFP-LC3报告体系", "mCherry-GFP-LC3 flux reporter")),
      required(perturbation, localized("Bafilomycin A1或Chloroquine", "Bafilomycin A1 or chloroquine"), localized("饥饿/MTOR抑制诱导条件", "Starvation or MTOR-inhibition induction condition")),
      required(qualityControls, localized("细胞活性和溶酶体酸化控制", "Cell-viability and lysosomal-acidification controls")),
    ],
    techniqueCodes: ["AUTOPHAGIC_FLUX_ASSAY", "WB", "CONFOCAL_LSM"],
  },
  {
    code: "MITOCHONDRIAL_METABOLISM",
    category: "CELLULAR_PROCESS",
    name: localized("线粒体代谢与生物能量学", "Mitochondrial metabolism and bioenergetics"),
    description: localized("围绕氧化磷酸化、糖酵解补偿、线粒体膜电位与底物依赖性描述细胞能量状态。", "Characterizes cellular energy state through oxidative phosphorylation, glycolytic compensation, membrane potential, and substrate dependency."),
    specializedReagents: localized("OCR/ECAR测试盒、电子传递链抑制剂、膜电位染料、代谢底物与稳定同位素内标。", "OCR/ECAR assay kits, electron-transport-chain inhibitors, membrane-potential dyes, metabolic substrates, and isotope standards."),
    targetRequirements: localized("将基础呼吸、ATP相关呼吸、最大呼吸和非线粒体耗氧与膜电位/线粒体量共同解释。", "Interpret basal, ATP-linked, maximal, and non-mitochondrial respiration together with membrane potential and mitochondrial mass."),
    targetPanel: { mechanistic: ["PPARGC1A/PGC-1α", "TFAM", "OXPHOS complexes I–V"], readout: ["OCR", "ECAR", "ATP相关呼吸", "膜电位"], controls: ["Oligomycin", "FCCP", "Rotenone/Antimycin A", "细胞数归一化"] },
    reagentRequirements: [
      required(primaryReadout, localized("OCR/ECAR微孔板与校准液", "OCR/ECAR microplates and calibration solution"), localized("膜电位与线粒体质量染料", "Membrane-potential and mitochondrial-mass dyes")),
      required(perturbation, localized("Oligomycin、FCCP、Rotenone/Antimycin A", "Oligomycin, FCCP, and rotenone/antimycin A")),
      required(qualityControls, localized("细胞数/蛋白量归一化试剂", "Cell-count or protein-normalization reagent"), localized("基线葡萄糖和谷氨酰胺条件", "Baseline glucose and glutamine conditions")),
    ],
    techniqueCodes: ["SEAHORSE_OCR_ECAR", "MITOCHONDRIAL_MEMBRANE_POTENTIAL", "ATP_LUMINESCENT_VIABILITY"],
  },
  {
    code: "OXIDATIVE_STRESS",
    category: "CELLULAR_PROCESS",
    name: localized("氧化应激与抗氧化反应", "Oxidative stress and antioxidant response"),
    description: localized("用于解析ROS来源、抗氧化适应和氧化损伤在细胞命运或信号传导中的作用。", "Dissects ROS sources, antioxidant adaptation, and oxidative damage in cell fate and signaling."),
    specializedReagents: localized("细胞内ROS探针、线粒体ROS探针、抗氧化剂、氧化剂和Nrf2通路抗体。", "Intracellular and mitochondrial ROS probes, antioxidants, oxidants, and Nrf2-pathway antibodies."),
    targetRequirements: localized("同时报告ROS、细胞活性和氧化损伤或NRF2靶基因，避免把探针荧光单独视为机制结论。", "Report ROS, viability, and oxidative damage or NRF2 targets together; probe fluorescence alone is not a mechanistic conclusion."),
    targetPanel: { mechanistic: ["NFE2L2/NRF2", "KEAP1", "SOD2", "HMOX1"], readout: ["总ROS", "线粒体ROS", "脂质过氧化", "抗氧化基因表达"], controls: ["N-acetylcysteine", "H2O2阳性对照", "无探针/单染控制"] },
    reagentRequirements: [
      required(primaryReadout, localized("细胞内和线粒体ROS荧光探针", "Intracellular and mitochondrial ROS fluorescent probes"), localized("NRF2/HMOX1抗体或qPCR引物", "NRF2/HMOX1 antibodies or qPCR primers")),
      required(perturbation, localized("N-acetylcysteine等抗氧化剂", "Antioxidant such as N-acetylcysteine"), localized("H2O2或其他氧化应激阳性对照", "H2O2 or another oxidative-stress positive control")),
      required(qualityControls, localized("活死染和自发荧光控制", "Viability dye and autofluorescence control")),
    ],
    techniqueCodes: ["INTRACELLULAR_ROS_ASSAY", "FLOW", "RT_QPCR"],
  },
  {
    code: "APOPTOSIS_CELL_DEATH",
    category: "CELLULAR_PROCESS",
    name: localized("凋亡与细胞死亡方式", "Apoptosis and cell-death modalities"),
    description: localized("区分早晚期凋亡、坏死性细胞膜破裂及需要进一步验证的替代性死亡方式。", "Distinguishes early/late apoptosis, membrane-rupturing death, and alternative death programs requiring further validation."),
    specializedReagents: localized("Annexin V/PI染色、Caspase活性试剂、裂解型Caspase/PARP抗体和LDH释放试剂。", "Annexin V/PI stain, caspase-activity reagents, cleaved caspase/PARP antibodies, and LDH-release reagents."),
    targetRequirements: localized("以时间序列联合Annexin V、Caspase和膜完整性读出；明确是否需要区分凋亡、焦亡、铁死亡或坏死性凋亡。", "Use time-resolved Annexin V, caspase, and membrane-integrity readouts; specify whether apoptosis, pyroptosis, ferroptosis, or necroptosis must be distinguished."),
    targetPanel: { mechanistic: ["CASP3", "CASP8", "BAX", "BCL2", "PARP1"], readout: ["Annexin V+/PI−", "Caspase-3/7活性", "裂解PARP", "LDH释放"], controls: ["Staurosporine阳性对照", "未处理对照", "Caspase抑制剂救援"] },
    reagentRequirements: [
      required(primaryReadout, localized("Annexin V/PI或7-AAD试剂盒", "Annexin V/PI or 7-AAD kit"), localized("Caspase-3/7活性试剂", "Caspase-3/7 activity reagent")),
      required(qualityControls, localized("裂解型Caspase-3和PARP抗体", "Cleaved caspase-3 and PARP antibodies"), localized("LDH释放或膜完整性试剂", "LDH-release or membrane-integrity reagent")),
    ],
    techniqueCodes: ["ANNEXIN_V_FLOW", "CASPASE_3_7_ASSAY", "LDH_RELEASE_ASSAY", "WB"],
  },
  {
    code: "CELL_CYCLE_PROLIFERATION",
    category: "CELLULAR_PROCESS",
    name: localized("细胞周期与增殖", "Cell cycle and proliferation"),
    description: localized("评估细胞周期停滞、复制进入和长期克隆形成，区分细胞数变化来自增殖还是死亡。", "Assesses cell-cycle arrest, S-phase entry, and long-term clonogenicity while separating proliferation changes from cell death."),
    specializedReagents: localized("DNA含量染料、EdU/BrdU掺入试剂、细胞周期蛋白抗体和增殖追踪染料。", "DNA-content dyes, EdU/BrdU incorporation reagents, cyclin antibodies, and proliferation-tracking dyes."),
    targetRequirements: localized("至少设定G0/G1、S和G2/M分布及EdU阳性比例；将Cyclin/CDK读出与活细胞数一并解释。", "Prespecify G0/G1, S, G2/M distribution and EdU positivity; interpret Cyclin/CDK readouts alongside viable-cell numbers."),
    targetPanel: { mechanistic: ["CCND1", "CDK4", "CDKN1A/p21", "TP53"], readout: ["EdU/BrdU阳性率", "DNA含量细胞周期", "克隆形成"], controls: ["血清饥饿停滞", "细胞周期阻断阳性对照", "活死细胞排除"] },
    reagentRequirements: [
      required(primaryReadout, localized("EdU/BrdU掺入试剂", "EdU/BrdU incorporation reagent"), localized("DNA含量染料", "DNA-content dye")),
      required(qualityControls, localized("活死染和单细胞门控控制", "Viability dye and singlet-gating control"), localized("Cyclin/p21抗体", "Cyclin/p21 antibodies")),
    ],
    techniqueCodes: ["CELL_CYCLE_FLOW", "EDU_INCORPORATION", "BRDU_INCORPORATION", "CLONOGENIC_ASSAY"],
  },
  {
    code: "CELLULAR_SENESCENCE",
    category: "CELLULAR_PROCESS",
    name: localized("细胞衰老与SASP", "Cellular senescence and SASP"),
    description: localized("以持久生长停滞、衰老相关β-半乳糖苷酶和分泌表型的组合界定细胞衰老。", "Defines cellular senescence through persistent growth arrest, SA-β-gal, and a secretory phenotype in combination."),
    specializedReagents: localized("SA-β-gal染色、p16/p21抗体、EdU试剂和SASP细胞因子检测面板。", "SA-β-gal staining, p16/p21 antibodies, EdU reagent, and SASP cytokine panels."),
    targetRequirements: localized("同时满足低增殖、SA-β-gal和p16/p21或SASP证据；避免把短期静止或毒性损伤误判为衰老。", "Require low proliferation, SA-β-gal, and p16/p21 or SASP evidence; do not call transient quiescence or toxic damage senescence."),
    targetPanel: { mechanistic: ["CDKN2A/p16", "CDKN1A/p21", "TP53"], readout: ["SA-β-gal", "EdU下降", "SASP分泌"], controls: ["复制性衰老或已知阳性对照", "增殖静止对照", "细胞死亡排除"] },
    reagentRequirements: [
      required(primaryReadout, localized("SA-β-gal染色试剂", "SA-β-gal staining reagent"), localized("p16/p21抗体", "p16/p21 antibodies")),
      required(qualityControls, localized("EdU掺入试剂", "EdU incorporation reagent"), localized("SASP细胞因子检测体系", "SASP cytokine assay")),
    ],
    techniqueCodes: ["SA_BETA_GAL_ASSAY", "EDU_INCORPORATION", "SANDWICH_ELISA", "WB"],
  },
  {
    code: "DNA_DAMAGE_RESPONSE",
    category: "CELLULAR_PROCESS",
    name: localized("DNA损伤应答", "DNA damage response"),
    description: localized("覆盖DNA损伤识别、修复通路激活和损伤后细胞命运。", "Covers DNA-damage recognition, repair-pathway activation, and cell fate after damage."),
    specializedReagents: localized("γH2AX/53BP1抗体、DNA损伤诱导剂、修复抑制剂和彗星实验或核内焦点成像材料。", "γH2AX/53BP1 antibodies, DNA-damaging agents, repair inhibitors, and comet-assay or nuclear-foci imaging materials."),
    targetRequirements: localized("明确损伤来源、时间点、损伤焦点与修复动力学，并用细胞周期状态控制复制压力干扰。", "Specify damage source, time points, foci, and repair kinetics, controlling for replication stress through cell-cycle state."),
    targetPanel: { mechanistic: ["ATM", "ATR", "TP53", "BRCA1", "RAD51"], readout: ["γH2AX焦点", "53BP1焦点", "CHK1/CHK2磷酸化"], controls: ["DNA损伤阳性对照", "修复抑制剂", "细胞周期分层"] },
    reagentRequirements: [
      required(primaryReadout, localized("γH2AX与53BP1抗体", "γH2AX and 53BP1 antibodies"), localized("DNA损伤阳性对照试剂", "DNA-damage positive-control reagent")),
      required(perturbation, localized("ATM/ATR或PARP通路抑制剂", "ATM/ATR or PARP-pathway inhibitor")),
      required(qualityControls, localized("细胞周期与活性控制", "Cell-cycle and viability controls")),
    ],
    techniqueCodes: ["IF", "WB", "CELL_CYCLE_FLOW"],
  },
  {
    code: "EMT_MIGRATION_INVASION",
    category: "CELLULAR_PROCESS",
    name: localized("上皮间质转化、迁移与侵袭", "EMT, migration, and invasion"),
    description: localized("将上皮/间质状态标志物与二维迁移、跨膜趋化和基质侵袭的功能读出整合。", "Integrates epithelial/mesenchymal state markers with 2D migration, transwell chemotaxis, and matrix invasion."),
    specializedReagents: localized("Matrigel或胶原基质、趋化因子、迁移小室和E-cadherin/Vimentin等抗体。", "Matrigel or collagen matrix, chemoattractants, migration chambers, and antibodies such as E-cadherin/Vimentin."),
    targetRequirements: localized("把细胞数/增殖控制纳入迁移和侵袭分析；用至少一项功能实验和一组EMT标志物支持结论。", "Include cell-count/proliferation controls in migration and invasion analyses; support conclusions with at least one functional assay and an EMT marker set."),
    targetPanel: { mechanistic: ["CDH1/E-cadherin", "VIM", "SNAI1", "ZEB1", "MMP2/MMP9"], readout: ["创伤闭合", "Transwell迁移", "Matrigel侵袭", "MMP活性"], controls: ["无血清迁移对照", "增殖抑制/归一化", "无基质膜对照"] },
    reagentRequirements: [
      required(primaryReadout, localized("Transwell迁移/侵袭小室", "Transwell migration/invasion chambers"), localized("Matrigel或胶原基质", "Matrigel or collagen matrix")),
      required(qualityControls, localized("E-cadherin、Vimentin和MMP抗体", "E-cadherin, Vimentin, and MMP antibodies"), localized("细胞活性/增殖归一化试剂", "Cell-viability/proliferation normalization reagent")),
    ],
    techniqueCodes: ["SCRATCH_WOUND_ASSAY", "TRANSWELL_MIGRATION", "MATRIGEL_INVASION", "GELATIN_ZYMOGRAPHY"],
  },
  {
    code: "ER_STRESS_PROTEOSTASIS",
    category: "CELLULAR_PROCESS",
    name: localized("内质网应激与蛋白稳态", "ER stress and proteostasis"),
    description: localized("评估未折叠蛋白反应、蛋白降解负荷和持续ER应激向细胞死亡或适应的转归。", "Assesses the unfolded-protein response, proteolytic load, and the transition from persistent ER stress to death or adaptation."),
    specializedReagents: localized("ER应激诱导剂、蛋白酶体抑制剂、XBP1剪接检测体系和UPR抗体。", "ER-stress inducers, proteasome inhibitors, XBP1-splicing assays, and UPR antibodies."),
    targetRequirements: localized("同时检测PERK、IRE1和ATF6分支中的至少两个节点，并把CHOP/凋亡读出与可逆应激区分。", "Measure at least two nodes across PERK, IRE1, and ATF6 branches and distinguish reversible stress from CHOP/apoptotic outcomes."),
    targetPanel: { mechanistic: ["HSPA5/GRP78", "EIF2AK3/PERK", "XBP1", "ATF4", "DDIT3/CHOP"], readout: ["XBP1剪接", "eIF2α磷酸化", "CHOP诱导"], controls: ["Tunicamycin或Thapsigargin", "蛋白酶体抑制剂", "细胞死亡控制"] },
    reagentRequirements: [
      required(primaryReadout, localized("GRP78、p-eIF2α、CHOP抗体", "GRP78, phospho-eIF2α, and CHOP antibodies"), localized("XBP1剪接PCR引物", "XBP1-splicing PCR primers")),
      required(perturbation, localized("Tunicamycin或Thapsigargin", "Tunicamycin or thapsigargin"), localized("蛋白酶体抑制剂", "Proteasome inhibitor")),
    ],
    techniqueCodes: ["WB", "RT_QPCR", "DUAL_LUCIFERASE_REPORTER"],
  },
  {
    code: "ECM_REMODELING",
    category: "TISSUE_MICROENVIRONMENT",
    name: localized("细胞外基质重塑与力学微环境", "Extracellular-matrix remodeling and mechanics"),
    description: localized("聚焦胶原沉积/降解、纤维化、基质收缩和细胞-基质黏附对组织微环境的影响。", "Focuses on collagen deposition/degradation, fibrosis, matrix contraction, and cell–matrix adhesion in the tissue microenvironment."),
    specializedReagents: localized("胶原/Matrigel基质、MMP底物或酶谱试剂、胶原染色、整合素/纤连蛋白抗体。", "Collagen/Matrigel matrices, MMP substrates or zymography reagents, collagen stains, and integrin/fibronectin antibodies."),
    targetRequirements: localized("将基质组成、降解活性和功能性收缩/侵袭读出共同报告；明确组织来源和基质批次。", "Report matrix composition, degradation activity, and functional contraction/invasion together; specify tissue source and matrix batch."),
    targetPanel: { mechanistic: ["COL1A1", "FN1", "ITGB1", "MMP2", "MMP9", "TGFB1"], readout: ["胶原沉积", "MMP酶谱", "胶原凝胶收缩", "基质侵袭"], controls: ["无细胞基质", "MMP抑制剂", "同批次基质对照"] },
    reagentRequirements: [
      required(primaryReadout, localized("胶原或Matrigel基质", "Collagen or Matrigel matrix"), localized("MMP酶谱/活性检测试剂", "MMP zymography/activity reagent")),
      required(qualityControls, localized("Sirius Red或Masson染色试剂", "Sirius Red or Masson staining reagent"), localized("COL1A1/FN1/MMP抗体", "COL1A1/FN1/MMP antibodies")),
      recommended(perturbation, localized("TGF-β刺激或MMP抑制剂", "TGF-β stimulus or MMP inhibitor")),
    ],
    techniqueCodes: ["GELATIN_ZYMOGRAPHY", "COLLAGEN_GEL_CONTRACTION", "SIRIUS_RED_STAINING", "MATRIGEL_INVASION"],
  },
  {
    code: "HYPOXIA_ANGIOGENESIS",
    category: "TISSUE_MICROENVIRONMENT",
    name: localized("缺氧、血管生成与灌注适应", "Hypoxia, angiogenesis, and perfusion adaptation"),
    description: localized("研究缺氧感知、HIF转录响应和血管生成相关表型在组织微环境中的耦合。", "Studies coupling of hypoxia sensing, HIF transcriptional response, and angiogenic phenotypes in tissue microenvironments."),
    specializedReagents: localized("低氧培养条件、缺氧探针、HIF/VEGF抗体、血管生成基质和氧张力记录材料。", "Hypoxic culture conditions, hypoxia probes, HIF/VEGF antibodies, angiogenesis matrices, and oxygen-tension records."),
    targetRequirements: localized("记录真实氧张力和暴露时长，联合HIF稳定、靶基因和管形成/迁移功能读出。", "Record actual oxygen tension and exposure time and combine HIF stabilization, target genes, and tube-formation/migration readouts."),
    targetPanel: { mechanistic: ["HIF1A", "EPAS1/HIF2A", "VEGFA", "CA9"], readout: ["HIF稳定", "VEGF分泌", "血管样结构", "缺氧探针信号"], controls: ["常氧对照", "缺氧模拟阳性对照", "氧张力记录"] },
    reagentRequirements: [
      required(primaryReadout, localized("缺氧培养或缺氧探针体系", "Hypoxia culture or probe system"), localized("HIF1A/VEGFA抗体或qPCR引物", "HIF1A/VEGFA antibodies or qPCR primers")),
      required(qualityControls, localized("氧张力与暴露时间记录", "Oxygen-tension and exposure-time record"), localized("常氧配对对照", "Normoxic paired control")),
    ],
    techniqueCodes: ["WB", "RT_QPCR", "SANDWICH_ELISA", "TRANSWELL_MIGRATION"],
  },
  {
    code: "EPITHELIAL_BARRIER",
    category: "TISSUE_MICROENVIRONMENT",
    name: localized("上皮屏障与极性", "Epithelial barrier and polarity"),
    description: localized("评估紧密连接、通透性和上皮极性在炎症、感染或药物作用下的变化。", "Assesses tight junctions, permeability, and epithelial polarity under inflammation, infection, or treatment."),
    specializedReagents: localized("Transwell插板、TEER电极、示踪通透性试剂、紧密连接抗体和极化培养基。", "Transwell inserts, TEER electrodes, tracer-permeability reagents, tight-junction antibodies, and polarization media."),
    targetRequirements: localized("以TEER和示踪物通透性作为功能读出，配合至少两个连接/极性标志物，并设置无细胞膜空白。", "Use TEER and tracer permeability as functional readouts with at least two junction/polarity markers and an acellular-insert blank."),
    targetPanel: { mechanistic: ["TJP1/ZO-1", "OCLN", "CLDN1", "EPCAM"], readout: ["TEER", "示踪物通透性", "连接连续性"], controls: ["无细胞插板", "完整单层对照", "破坏屏障阳性对照"] },
    reagentRequirements: [
      required(primaryReadout, localized("Transwell插板和TEER测量设备", "Transwell inserts and TEER instrument"), localized("荧光示踪通透性试剂", "Fluorescent tracer-permeability reagent")),
      required(qualityControls, localized("ZO-1、Occludin、Claudin抗体", "ZO-1, Occludin, and Claudin antibodies"), localized("无细胞膜空白", "Acellular membrane blank")),
    ],
    techniqueCodes: ["TEER_ASSAY", "IF", "TRANSWELL_INDIRECT_COCULTURE"],
  },
  {
    code: "STEMNESS_DIFFERENTIATION",
    category: "TISSUE_MICROENVIRONMENT",
    name: localized("干性、分化与类器官表型", "Stemness, differentiation, and organoid phenotypes"),
    description: localized("用于连接干/祖细胞状态、谱系分化、三维组织结构和治疗反应。", "Connects stem/progenitor state, lineage differentiation, 3D tissue structure, and treatment response."),
    specializedReagents: localized("定义培养基、基质胶、谱系分化因子、类器官解离试剂和身份标志抗体。", "Defined media, matrix gels, lineage-differentiation factors, organoid dissociation reagents, and identity-marker antibodies."),
    targetRequirements: localized("为每个模型预设谱系身份、成熟度、结构/活率阈值和至少一项功能性读出。", "Prespecify lineage identity, maturity, structural/viability thresholds, and at least one functional readout for each model."),
    targetPanel: { mechanistic: ["SOX2", "NANOG", "LGR5", "谱系特异性转录因子"], readout: ["类器官形成率", "尺寸/分支", "谱系标志", "药物反应"], controls: ["已知分化阳性对照", "支原体阴性", "基质批次控制"] },
    reagentRequirements: [
      required(primaryReadout, localized("定义培养基与基质胶", "Defined media and matrix gel"), localized("谱系分化因子", "Lineage-differentiation factors")),
      required(qualityControls, localized("支原体检测试剂", "Mycoplasma test"), localized("干性/谱系身份标志抗体", "Stemness/lineage-identity antibodies")),
    ],
    techniqueCodes: ["ORGANOID_CULTURE", "ORGANOID_VIABILITY_ASSAY", "IF", "SPHEROID_FORMATION_ASSAY"],
  },
  {
    code: "TUMOR_MICROENVIRONMENT",
    category: "TISSUE_MICROENVIRONMENT",
    name: localized("肿瘤微环境与细胞互作", "Tumor microenvironment and cell interactions"),
    description: localized("整合肿瘤、基质和免疫细胞的共培养、空间定位与旁分泌互作读出。", "Integrates tumor, stromal, and immune co-culture, spatial localization, and paracrine-interaction readouts."),
    specializedReagents: localized("直接/间接共培养体系、细胞追踪染料、细胞因子检测面板和多重组织标记抗体。", "Direct/indirect co-culture systems, cell trackers, cytokine panels, and multiplex tissue-marker antibodies."),
    targetRequirements: localized("明确各细胞来源、比例和时程；为每个互作假设预设至少一个分泌性和一个空间/接触性读出。", "Specify cell origins, ratios, and timing; prespecify at least one secreted and one spatial/contact readout for each interaction hypothesis."),
    targetPanel: { mechanistic: ["CAF标志", "PDGFRB", "COL1A1", "免疫浸润标志"], readout: ["细胞因子分泌", "迁移/侵袭", "空间共定位", "细胞比例"], controls: ["单培养对照", "无接触共培养对照", "细胞身份追踪"] },
    reagentRequirements: [
      required(primaryReadout, localized("直接或Transwell共培养耗材", "Direct or Transwell co-culture materials"), localized("细胞追踪染料", "Cell-tracking dye")),
      required(qualityControls, localized("细胞因子ELISA/珠阵列", "Cytokine ELISA/bead array"), localized("多重免疫表型抗体面板", "Multiplex immunophenotyping antibody panel")),
    ],
    techniqueCodes: ["DIRECT_MIXED_CELL_COCULTURE", "TRANSWELL_INDIRECT_COCULTURE", "MULTIPLEX_IF", "SANDWICH_ELISA"],
  },
  ...expandedCommonPathwayDomains,
  {
    code: "INFLAMMASOME",
    category: "IMMUNE",
    name: localized("炎性小体与焦亡", "Inflammasome activation and pyroptosis"),
    description: localized("以启动、组装、Caspase-1活化、细胞因子成熟和膜孔形成的连续证据界定炎性小体。", "Defines inflammasome activity through priming, assembly, caspase-1 activation, cytokine maturation, and pore formation."),
    specializedReagents: localized("LPS启动剂、NLRP3激动剂、Caspase-1/IL-1β抗体、ASC斑点成像试剂和LDH检测体系。", "LPS primer, NLRP3 agonist, caspase-1/IL-1β antibodies, ASC-speck imaging reagents, and LDH assay."),
    targetRequirements: localized("将启动和激活两个阶段分开设计，要求同时具备Caspase-1活化、成熟IL-1β/IL-18与膜孔/裂解证据。", "Design priming and activation separately and require caspase-1 activation, mature IL-1β/IL-18, and pore/lysis evidence together."),
    targetPanel: { mechanistic: ["NLRP3", "PYCARD/ASC", "CASP1", "GSDMD"], readout: ["裂解Caspase-1", "成熟IL-1β/IL-18", "ASC speck", "LDH释放"], controls: ["LPS-only启动", "Caspase-1或NLRP3抑制剂", "GSDMD排除/救援"] },
    reagentRequirements: [
      required(primaryReadout, localized("Caspase-1、GSDMD、IL-1β抗体", "Caspase-1, GSDMD, and IL-1β antibodies"), localized("IL-1β/IL-18定量试剂", "IL-1β/IL-18 quantitation reagent")),
      required(perturbation, localized("LPS启动剂与NLRP3激动剂", "LPS primer and NLRP3 agonist"), localized("NLRP3或Caspase-1抑制剂", "NLRP3 or caspase-1 inhibitor")),
      required(qualityControls, localized("LDH释放与活细胞控制", "LDH-release and viable-cell controls")),
    ],
    techniqueCodes: ["WB", "SANDWICH_ELISA", "LDH_RELEASE_ASSAY", "IF"],
  },
  {
    code: "T_CELL_ACTIVATION_EXHAUSTION",
    category: "IMMUNE",
    name: localized("T细胞活化、分化与耗竭", "T-cell activation, differentiation, and exhaustion"),
    description: localized("按初始/记忆/效应/耗竭状态并结合功能性细胞因子、增殖和杀伤读出解析T细胞。", "Profiles naïve, memory, effector, and exhausted states with functional cytokine, proliferation, and killing readouts."),
    specializedReagents: localized("TCR刺激珠、CD4/CD8和分化/耗竭抗体面板、胞内细胞因子染色、活死染和Fc封闭剂。", "TCR stimulation beads, CD4/CD8 and differentiation/exhaustion antibody panels, intracellular cytokine staining, viability dye, and Fc block."),
    targetRequirements: localized("按CD4/CD8及初始/记忆分层；耗竭标志需与功能下降或刺激反应一同解释，不能只测单一PD-1。", "Stratify by CD4/CD8 and naïve/memory state; interpret exhaustion markers with functional loss or stimulus response, not PD-1 alone."),
    targetPanel: { mechanistic: ["CD3", "CD4", "CD8A", "PDCD1/PD-1", "HAVCR2/TIM-3", "TOX"], readout: ["CD69/CD25", "IFN-γ/TNF/IL-2", "增殖", "细胞毒性"], controls: ["FMO控制", "未刺激和TCR刺激对照", "活死和双细胞排除"] },
    reagentRequirements: [
      required(primaryReadout, localized("CD3/CD4/CD8/PD-1/TIM-3抗体面板", "CD3/CD4/CD8/PD-1/TIM-3 antibody panel"), localized("胞内IFN-γ/TNF/IL-2抗体", "Intracellular IFN-γ/TNF/IL-2 antibodies")),
      required(perturbation, localized("CD3/CD28刺激珠", "CD3/CD28 stimulation beads")),
      required(qualityControls, localized("Fc受体封闭、活死染、FMO控制", "Fc block, viability dye, and FMO controls")),
    ],
    techniqueCodes: ["MULTICOLOR_IMMUNOPHENOTYPING", "INTRACELLULAR_CYTOKINE_FLOW", "FLOW", "SINGLE_CELL_VDJ_SEQUENCING"],
  },
  {
    code: "B_CELL_HUMORAL_IMMUNITY",
    category: "IMMUNE",
    name: localized("B细胞、浆细胞与体液免疫", "B cells, plasma cells, and humoral immunity"),
    description: localized("细分B细胞成熟、记忆/浆细胞分化、抗体分泌与BCR克隆扩增。", "Dissects B-cell maturation, memory/plasma-cell differentiation, antibody secretion, and BCR clonal expansion."),
    specializedReagents: localized("B细胞表型抗体、BCR/VDJ建库试剂、免疫球蛋白ELISA和抗原探针。", "B-cell phenotyping antibodies, BCR/VDJ library reagents, immunoglobulin ELISA, and antigen probes."),
    targetRequirements: localized("区分初始、记忆、浆母/浆细胞群；抗体量需与总细胞/存活率及抗原特异性或克隆型解释配对。", "Distinguish naïve, memory, plasmablast/plasma-cell populations; pair antibody amount with total cells/viability and antigen specificity or clonotype."),
    targetPanel: { mechanistic: ["MS4A1/CD20", "CD27", "CD38", "SDC1/CD138", "PRDM1/BLIMP1"], readout: ["IgG/IgA/IgM分泌", "BCR克隆型", "抗原结合"], controls: ["FMO控制", "未刺激B细胞", "同型/抗原无关探针"] },
    reagentRequirements: [
      required(primaryReadout, localized("B细胞/浆细胞流式抗体面板", "B-cell/plasma-cell flow antibody panel"), localized("IgG/IgA/IgM定量ELISA", "IgG/IgA/IgM quantitation ELISA")),
      required(qualityControls, localized("BCR/VDJ引物或单细胞VDJ建库试剂", "BCR/VDJ primers or single-cell VDJ library reagents"), localized("Fc封闭和FMO控制", "Fc block and FMO controls")),
    ],
    techniqueCodes: ["MULTICOLOR_IMMUNOPHENOTYPING", "SANDWICH_ELISA", "SINGLE_CELL_VDJ_SEQUENCING", "FLOW"],
  },
  {
    code: "NK_CELL_CYTOTOXICITY",
    category: "IMMUNE",
    name: localized("NK细胞杀伤与ADCC", "NK-cell cytotoxicity and ADCC"),
    description: localized("评估NK细胞识别、脱颗粒、细胞毒性和抗体依赖性细胞介导杀伤。", "Assesses NK recognition, degranulation, cytotoxicity, and antibody-dependent cellular cytotoxicity."),
    specializedReagents: localized("NK表型和CD107a抗体、靶细胞标记染料、杀伤/LDH检测试剂、Fc受体与治疗抗体对照。", "NK phenotype and CD107a antibodies, target-cell dyes, killing/LDH assays, and Fc receptor/therapeutic-antibody controls."),
    targetRequirements: localized("记录效应:靶细胞比和时间；将CD107a、细胞因子与靶细胞死亡配对，并在ADCC中加入无抗体和Fc依赖性对照。", "Record effector:target ratio and time; pair CD107a and cytokines with target death, and include no-antibody and Fc-dependence controls for ADCC."),
    targetPanel: { mechanistic: ["NCR1/NKp46", "KLRD1/CD94", "FCGR3A/CD16", "GZMB", "PRF1"], readout: ["CD107a脱颗粒", "靶细胞死亡", "IFN-γ", "ADCC"], controls: ["靶细胞单独", "无抗体", "同型抗体", "E:T梯度"] },
    reagentRequirements: [
      required(primaryReadout, localized("CD56/CD16/CD107a及细胞毒分子抗体", "CD56/CD16/CD107a and cytotoxic-molecule antibodies"), localized("靶细胞标记或死亡检测体系", "Target-cell labeling or death-detection system")),
      required(qualityControls, localized("效应:靶细胞比梯度", "Effector:target ratio series"), localized("无抗体和同型抗体对照", "No-antibody and isotype-antibody controls")),
    ],
    techniqueCodes: ["NK_CELL_CYTOTOXICITY", "ADCC_ASSAY", "FLOW", "INTRACELLULAR_CYTOKINE_FLOW"],
  },
  {
    code: "MYELOID_INNATE_IMMUNITY",
    category: "IMMUNE",
    name: localized("髓系细胞与先天免疫", "Myeloid cells and innate immunity"),
    description: localized("围绕单核细胞、巨噬细胞、树突细胞和粒细胞的谱系、极化、吞噬和炎症功能进行细分。", "Dissects lineage, polarization, phagocytosis, and inflammatory functions of monocytes, macrophages, dendritic cells, and granulocytes."),
    specializedReagents: localized("髓系流式抗体面板、吞噬颗粒、TLR刺激剂、细胞因子检测和Fc封闭剂。", "Myeloid flow antibody panels, phagocytic particles, TLR stimuli, cytokine assays, and Fc block."),
    targetRequirements: localized("先定义谱系门控和组织/血液来源，再在刺激背景下解释极化和细胞因子；避免把单一CD206或CD86等同于功能状态。", "Define lineage gating and tissue/blood origin before interpreting polarization and cytokines under stimulation; do not equate a single CD206 or CD86 marker with functional state."),
    targetPanel: { mechanistic: ["CD14", "ITGAM/CD11b", "HLA-DRA", "CD68", "MRC1/CD206"], readout: ["吞噬", "ROS", "TNF/IL-6/IL-10", "抗原呈递"], controls: ["FMO控制", "TLR刺激/未刺激", "吞噬抑制控制"] },
    reagentRequirements: [
      required(primaryReadout, localized("髓系谱系/活化流式抗体面板", "Myeloid lineage/activation flow antibody panel"), localized("荧光吞噬颗粒", "Fluorescent phagocytosis particles")),
      required(perturbation, localized("TLR刺激剂", "TLR agonist")),
      required(qualityControls, localized("Fc封闭、活死染与FMO控制", "Fc block, viability dye, and FMO controls")),
    ],
    techniqueCodes: ["PHAGOCYTOSIS_ASSAY", "MULTICOLOR_IMMUNOPHENOTYPING", "INTRACELLULAR_ROS_ASSAY", "SANDWICH_ELISA"],
  },
  {
    code: "CHECKPOINT_IMMUNITY",
    category: "IMMUNE",
    name: localized("免疫检查点与免疫抑制", "Immune checkpoints and suppression"),
    description: localized("从配体表达、受体共表达、功能抑制到阻断恢复，描述检查点轴而不是只报告单个蛋白。", "Describes checkpoint axes from ligand expression and receptor co-expression through functional suppression and blockade rescue, not a single protein alone."),
    specializedReagents: localized("PD-1/PD-L1、CTLA-4、LAG-3、TIGIT抗体面板，阻断抗体及共培养功能试剂。", "PD-1/PD-L1, CTLA-4, LAG-3, TIGIT antibody panels, blocking antibodies, and co-culture functional reagents."),
    targetRequirements: localized("在相同细胞亚群内配对受体与配体，并以阻断前后细胞因子、增殖或杀伤恢复作为功能证据。", "Pair receptor and ligand in matched cell subsets and use cytokine, proliferation, or killing rescue before/after blockade as functional evidence."),
    targetPanel: { mechanistic: ["PDCD1/PD-1", "CD274/PD-L1", "CTLA4", "LAG3", "TIGIT"], readout: ["受体/配体共表达", "T细胞细胞因子", "增殖", "杀伤恢复"], controls: ["FMO控制", "同型阻断抗体", "受体或配体阴性对照"] },
    reagentRequirements: [
      required(primaryReadout, localized("检查点受体/配体流式或IHC抗体", "Checkpoint receptor/ligand flow or IHC antibodies"), localized("功能性阻断抗体", "Functional blocking antibody")),
      required(qualityControls, localized("同型抗体与FMO控制", "Isotype-antibody and FMO controls"), localized("共培养未阻断对照", "Unblocked co-culture control")),
    ],
    techniqueCodes: ["MULTICOLOR_IMMUNOPHENOTYPING", "IHC", "DIRECT_MIXED_CELL_COCULTURE", "INTRACELLULAR_CYTOKINE_FLOW"],
  },
  {
    code: "IMMUNE_METABOLISM",
    category: "IMMUNE",
    name: localized("免疫代谢", "Immunometabolism"),
    description: localized("将免疫细胞亚群和活化状态与糖酵解、氧化磷酸化、脂质代谢及营养限制关联。", "Links immune-cell subsets and activation states to glycolysis, oxidative phosphorylation, lipid metabolism, and nutrient limitation."),
    specializedReagents: localized("OCR/ECAR试剂、葡萄糖摄取/脂质染料、代谢抑制剂和免疫表型抗体面板。", "OCR/ECAR reagents, glucose-uptake/lipid dyes, metabolic inhibitors, and immunophenotyping panels."),
    targetRequirements: localized("在已定义的免疫细胞亚群和刺激状态下进行代谢测量，使用细胞数、活性和细胞大小归一化。", "Measure metabolism in defined immune subsets and stimulation states, normalized to cell number, viability, and cell size."),
    targetPanel: { mechanistic: ["MTOR", "AMPK", "HIF1A", "CPT1A", "SLC2A1/GLUT1"], readout: ["OCR/ECAR", "葡萄糖摄取", "脂质积累", "细胞因子"], controls: ["细胞数归一化", "代谢抑制剂", "未刺激免疫细胞"] },
    reagentRequirements: [
      required(primaryReadout, localized("OCR/ECAR测试体系", "OCR/ECAR assay system"), localized("葡萄糖摄取或脂质荧光探针", "Glucose-uptake or lipid fluorescent probe")),
      required(perturbation, localized("糖酵解/线粒体代谢抑制剂", "Glycolysis/mitochondrial-metabolism inhibitors")),
      required(qualityControls, localized("免疫亚群抗体与活死染", "Immune-subset antibodies and viability dye")),
    ],
    techniqueCodes: ["SEAHORSE_OCR_ECAR", "FLOW", "PHOSPHO_FLOW", "INTRACELLULAR_CYTOKINE_FLOW"],
  },
  {
    code: "ANTIGEN_PRESENTATION",
    category: "IMMUNE",
    name: localized("抗原加工与呈递", "Antigen processing and presentation"),
    description: localized("细化MHC-I/MHC-II表达、共刺激、抗原摄取与呈递后T细胞激活的链条。", "Dissects the chain from MHC-I/MHC-II expression and co-stimulation through antigen uptake and presentation-driven T-cell activation."),
    specializedReagents: localized("抗原或肽池、MHC-I/MHC-II及CD80/CD86抗体、抗原摄取探针和T细胞共培养试剂。", "Antigens or peptide pools, MHC-I/MHC-II and CD80/CD86 antibodies, antigen-uptake probes, and T-cell co-culture reagents."),
    targetRequirements: localized("对抗原负载、呈递细胞类型和共培养时间进行预注册；以MHC/共刺激与抗原特异性T细胞反应共同证实。", "Prespecify antigen loading, APC type, and co-culture duration; establish with MHC/co-stimulation plus antigen-specific T-cell response."),
    targetPanel: { mechanistic: ["HLA-A/B/C", "HLA-DRA", "B2M", "CD80", "CD86"], readout: ["抗原摄取", "MHC表达", "T细胞CD69/细胞因子"], controls: ["无抗原", "无关肽", "MHC阻断", "未成熟APC"] },
    reagentRequirements: [
      required(primaryReadout, localized("抗原/肽池与抗原摄取探针", "Antigen/peptide pool and antigen-uptake probe"), localized("MHC-I/MHC-II/CD80/CD86抗体", "MHC-I/MHC-II/CD80/CD86 antibodies")),
      required(qualityControls, localized("无关肽、无抗原与MHC阻断对照", "Irrelevant-peptide, no-antigen, and MHC-blockade controls"), localized("T细胞活化读出抗体", "T-cell activation-readout antibodies")),
    ],
    techniqueCodes: ["FLOW", "MULTICOLOR_IMMUNOPHENOTYPING", "DIRECT_MIXED_CELL_COCULTURE", "INTRACELLULAR_CYTOKINE_FLOW"],
  },
  {
    code: "COMPLEMENT_FC_EFFECTOR",
    category: "IMMUNE",
    name: localized("补体与Fc效应功能", "Complement and Fc effector functions"),
    description: localized("覆盖补体激活、调理、溶血和Fc受体介导的吞噬或ADCC效应。", "Covers complement activation, opsonization, hemolysis, and Fc-receptor-mediated phagocytosis or ADCC."),
    specializedReagents: localized("新鲜或标准化补体来源、C3/C5b-9检测试剂、溶血试剂、Fc受体抗体和免疫复合物对照。", "Fresh or standardized complement source, C3/C5b-9 assays, hemolysis reagents, Fc-receptor antibodies, and immune-complex controls."),
    targetRequirements: localized("区分补体依赖和Fc依赖效应；记录热灭活补体、无抗体和同型抗体等关键排除对照。", "Separate complement- from Fc-dependent effects; record heat-inactivated complement, no-antibody, and isotype-antibody exclusion controls."),
    targetPanel: { mechanistic: ["C3", "C5", "C5B-9", "FCGR3A/CD16", "FCGR1A/CD64"], readout: ["C3沉积", "MAC形成", "溶血", "ADCC/吞噬"], controls: ["热灭活补体", "无抗体", "同型抗体", "Fc受体阻断"] },
    reagentRequirements: [
      required(primaryReadout, localized("C3/C5b-9检测抗体或试剂", "C3/C5b-9 detection antibody or reagent"), localized("标准化补体来源", "Standardized complement source")),
      required(qualityControls, localized("热灭活补体对照", "Heat-inactivated complement control"), localized("Fc受体阻断和同型抗体", "Fc-receptor block and isotype antibody")),
    ],
    techniqueCodes: ["HEMOLYSIS_ASSAY", "ADCC_ASSAY", "PHAGOCYTOSIS_ASSAY", "FLOW"],
  },
  {
    code: "IMMUNE_TRAFFICKING",
    category: "IMMUNE",
    name: localized("免疫细胞趋化、迁移与组织浸润", "Immune-cell chemotaxis, migration, and tissue infiltration"),
    description: localized("连接趋化因子轴、跨内皮迁移和组织内浸润表型。", "Connects chemokine axes with transendothelial migration and tissue-infiltration phenotypes."),
    specializedReagents: localized("趋化因子、Transwell小室、内皮细胞单层、细胞追踪染料和趋化受体抗体。", "Chemokines, Transwell chambers, endothelial monolayers, cell trackers, and chemokine-receptor antibodies."),
    targetRequirements: localized("明确趋化梯度、迁移细胞类型和时间；同时验证趋化受体表达和迁移细胞的活性/回收率。", "Specify chemokine gradient, migrating cell type, and time; verify receptor expression and viability/recovery of migrated cells."),
    targetPanel: { mechanistic: ["CXCR3", "CXCR4", "CCR7", "CCL2", "CXCL9/CXCL10"], readout: ["趋化指数", "Transwell迁移", "跨内皮迁移", "迁移后表型"], controls: ["无趋化因子", "等浓度上下室", "受体阻断", "活死控制"] },
    reagentRequirements: [
      required(primaryReadout, localized("趋化因子和Transwell迁移小室", "Chemokines and Transwell migration chambers"), localized("趋化受体流式抗体", "Chemokine-receptor flow antibodies")),
      required(qualityControls, localized("无趋化因子与等浓度对照", "No-chemokine and equal-concentration controls"), localized("细胞追踪/活死染料", "Cell tracker/viability dye")),
    ],
    techniqueCodes: ["CHEMOTAXIS_ASSAY", "TRANSWELL_MIGRATION", "FLOW", "TRANSWELL_INDIRECT_COCULTURE"],
  },
];

const phenotypePathwayDomainByCode = new Map(
  phenotypePathwayDomains.map((domain) => [domain.code, domain]),
);

export function getPhenotypePathwayDomain(code?: string | null) {
  return code
    ? phenotypePathwayDomainByCode.get(code as PhenotypePathwayCode) ?? null
    : null;
}

export function techniquePhenotypePathwayCodes(techniqueCode: string) {
  return phenotypePathwayDomains
    .filter((domain) => domain.techniqueCodes.includes(techniqueCode))
    .map((domain) => domain.code);
}

export function summarizePhenotypePathwayDomains(availableTechniqueCodes: Iterable<string>) {
  const available = new Set(availableTechniqueCodes);
  return phenotypePathwayDomains.map((domain) => ({
    ...domain,
    techniqueCount: domain.techniqueCodes.filter((code) => available.has(code)).length,
  }));
}
