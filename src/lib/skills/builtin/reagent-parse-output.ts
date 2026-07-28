export const REAGENT_PARSE_OUTPUT_SKILL_ID = "reagent-parse-output";

type OutputContractContext = {
  tagList: string;
  subCategoryList: string;
};

// 试剂结构化输出技能的核心：输出契约。主解析流程启用该技能时，
// 系统提示词中的输出格式部分由这里提供（替代内置的精简说明），
// 模型只需返回契约定义的严格 JSON，解析侧仍走既有的容错解析管线。
export function buildReagentStructuredOutputContract(lang: "zh" | "en", context: OutputContractContext) {
  if (lang === "en") {
    return [
      "Return STRICT JSON only. Do not add markdown or explanations.",
      "Allowed category: ANTIBODY, BUFFER, KIT, PRIMER, BIOLOGICAL, CHEMICAL, CONSUMABLE, OTHER.",
      "Keys must be: category, subCategory, vendor, confidence, warnings, experimentTags, antibodyMeta, primerMeta.",
      `subCategory should prefer these standard values when applicable: ${context.subCategoryList}.`,
      `experimentTags must be chosen from: ${context.tagList}.`,
      "Use uppercase antibody roles: PRIMARY or SECONDARY.",
      "Antibody tag rule: when category=ANTIBODY and antibodyMeta.role=PRIMARY, include WB_PRIMARY_ANTIBODY at minimum. Never add a PRIMARY antibody tag when antibodyMeta.role=SECONDARY; add IF/FLOW/ELISA antibody tags only when supported by product evidence.",
      "If the reagent is a primer/probe, fill primerMeta.targetName and primerMeta.isReferenceGene.",
      "If the reagent is an antibody, fill antibodyMeta.role, antibodyMeta.hostSpecies, antibodyMeta.targetSpecies, antibodyMeta.targetName.",
      "Map common reagents to standard tags, e.g. DMEM->CELL_CULTURE_MEDIUM, FBS->SERUM_SUPPLEMENT, puromycin->SELECTION_ANTIBIOTIC, Lipofectamine 3000->TRANSFECTION_REAGENT, RIPA->WB_LYSIS_BUFFER, PVDF membrane->WB_TRANSFER_MEMBRANE, BCA kit->PROTEIN_QUANTIFICATION_REAGENT, TRIzol->RNA_EXTRACTION_REAGENT, plasmid miniprep->PLASMID_PREP_REAGENT, PFA->FIXATIVE, Triton X-100->PERMEABILIZATION_REAGENT, DAPI->NUCLEAR_STAIN, antifade mounting medium->MOUNTING_MEDIUM, ExoQuick->EXOSOME_ISOLATION_REAGENT.",
      "Bioactive ligands, recombinant cytokines, growth factors and hormones should usually include CELL_STIMULATION_REAGENT, and pathway ligands/inhibitors/activators should usually include SIGNALING_MODULATOR.",
      "Use finer semantic tags when evidence is clear, such as OSTEOCLAST_DIFFERENTIATION_REAGENT, BONE_REMODELING_SIGNAL, IMMUNE_CYTOKINE_REAGENT, OSTEOGENIC_DIFFERENTIATION_REAGENT, ECM_COATING_REAGENT, STEM_CELL_MATRIX.",
      "Bioactive reagents such as recombinant proteins, cytokines, growth factors, enzymes, plasmids, viral vectors, siRNA/shRNA and CRISPR reagents should prefer category=BIOLOGICAL.",
      "Example: Soluble RANK Ligand (sRANKL) Protein, Recombinant human -> category=BIOLOGICAL, subCategory=Recombinant Protein.",
      "If reagent is transfection reagent (e.g., Lipofectamine), prefer category=CHEMICAL or KIT.",
    ].join(" ");
  }
  return [
    "必须仅返回严格 JSON，不要输出 markdown 或解释文本。",
    "category 只允许：ANTIBODY, BUFFER, KIT, PRIMER, BIOLOGICAL, CHEMICAL, CONSUMABLE, OTHER。",
    "字段必须是：category, subCategory, vendor, confidence, warnings, experimentTags, antibodyMeta, primerMeta。",
    `subCategory 若适用，优先使用这些标准值：${context.subCategoryList}。`,
    `experimentTags 只能从以下固定词表中选择：${context.tagList}。`,
    "antibodyMeta.role 必须使用大写 PRIMARY 或 SECONDARY。",
    "抗体标签规则：当 category=ANTIBODY 且 antibodyMeta.role=PRIMARY 时，至少必须包含 WB_PRIMARY_ANTIBODY。若 antibodyMeta.role=SECONDARY，绝不可添加任何一抗标签；IF/FLOW/ELISA 抗体标签仅在商品证据支持时添加。",
    "若为引物/探针，请填写 primerMeta.targetName 与 primerMeta.isReferenceGene。",
    "若为抗体，请填写 antibodyMeta.role、antibodyMeta.hostSpecies、antibodyMeta.targetSpecies、antibodyMeta.targetName。",
    "常见试剂请映射到标准标签，例如 DMEM->CELL_CULTURE_MEDIUM，FBS->SERUM_SUPPLEMENT，puromycin->SELECTION_ANTIBIOTIC，Lipofectamine 3000->TRANSFECTION_REAGENT，RIPA->WB_LYSIS_BUFFER，PVDF 膜->WB_TRANSFER_MEMBRANE，BCA 试剂盒->PROTEIN_QUANTIFICATION_REAGENT，TRIzol->RNA_EXTRACTION_REAGENT，质粒小提试剂盒->PLASMID_PREP_REAGENT，PFA->FIXATIVE，Triton X-100->PERMEABILIZATION_REAGENT，DAPI->NUCLEAR_STAIN，抗淬灭封片液->MOUNTING_MEDIUM，ExoQuick->EXOSOME_ISOLATION_REAGENT。",
    "对生物活性配体、重组细胞因子、生长因子、激素等，通常补充 CELL_STIMULATION_REAGENT；对配体/抑制剂/激动剂等通路调节试剂，通常补充 SIGNALING_MODULATOR。",
    "若证据充分，应进一步输出更细的实验语义标签，例如 OSTEOCLAST_DIFFERENTIATION_REAGENT、BONE_REMODELING_SIGNAL、IMMUNE_CYTOKINE_REAGENT、OSTEOGENIC_DIFFERENTIATION_REAGENT、ECM_COATING_REAGENT、STEM_CELL_MATRIX。",
    "对重组蛋白、细胞因子、生长因子、酶、质粒/病毒载体、siRNA/shRNA、CRISPR 试剂等生物活性试剂，优先归类为 BIOLOGICAL，并给出标准 subCategory。",
    "示例：Soluble RANK Ligand (sRANKL) Protein, Recombinant human -> category=BIOLOGICAL, subCategory=Recombinant Protein。",
    "若为转染试剂（如 Lipofectamine），优先归类 CHEMICAL 或 KIT。",
  ].join(" ");
}
