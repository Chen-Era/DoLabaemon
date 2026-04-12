import { experimentTags } from "@/lib/rules/catalog";
import { standardSubCategories } from "@/lib/reagent-tagging";

type RetrievalPromptContext = {
  candidateCategories?: string[];
  candidateSubCategories?: string[];
  candidateExperimentTags?: string[];
  evidenceLines?: string[];
};

export function buildReagentParsePrompt(lang: "zh" | "en", retrievalContext?: RetrievalPromptContext) {
  const tagList = experimentTags.join(", ");
  const subCategoryList = standardSubCategories.join(", ");
  const retrievalSummary = retrievalContext
    ? [
        retrievalContext.candidateCategories?.length ? `Candidate categories: ${retrievalContext.candidateCategories.join(", ")}.` : null,
        retrievalContext.candidateSubCategories?.length
          ? `Candidate subCategories: ${retrievalContext.candidateSubCategories.join(", ")}.`
          : null,
        retrievalContext.candidateExperimentTags?.length
          ? `Candidate experimentTags: ${retrievalContext.candidateExperimentTags.join(", ")}.`
          : null,
        retrievalContext.evidenceLines?.length ? `Evidence: ${retrievalContext.evidenceLines.join(" | ")}.` : null,
      ]
        .filter(Boolean)
        .join(" ")
    : "";
  if (lang === "en") {
    return [
      "You are a biomedical reagent curator.",
      "Return STRICT JSON only. Do not add markdown or explanations.",
      "Allowed category: ANTIBODY, BUFFER, KIT, PRIMER, BIOLOGICAL, CHEMICAL, CONSUMABLE, OTHER.",
      "Keys must be: category, subCategory, vendor, confidence, warnings, experimentTags, antibodyMeta, primerMeta.",
      `subCategory should prefer these standard values when applicable: ${subCategoryList}.`,
      `experimentTags must be chosen from: ${tagList}.`,
      "Use uppercase antibody roles: PRIMARY or SECONDARY.",
      "If the reagent is a primer/probe, fill primerMeta.targetName and primerMeta.isReferenceGene.",
      "If the reagent is an antibody, fill antibodyMeta.role, antibodyMeta.hostSpecies, antibodyMeta.targetSpecies, antibodyMeta.targetName.",
      "Map common reagents to standard tags, e.g. DMEM->CELL_CULTURE_MEDIUM, FBS->SERUM_SUPPLEMENT, puromycin->SELECTION_ANTIBIOTIC, Lipofectamine 3000->TRANSFECTION_REAGENT, RIPA->WB_LYSIS_BUFFER, PVDF membrane->WB_TRANSFER_MEMBRANE, BCA kit->PROTEIN_QUANTIFICATION_REAGENT, TRIzol->RNA_EXTRACTION_REAGENT, plasmid miniprep->PLASMID_PREP_REAGENT, PFA->FIXATIVE, Triton X-100->PERMEABILIZATION_REAGENT, DAPI->NUCLEAR_STAIN, antifade mounting medium->MOUNTING_MEDIUM, ExoQuick->EXOSOME_ISOLATION_REAGENT.",
      "Bioactive ligands, recombinant cytokines, growth factors and hormones should usually include CELL_STIMULATION_REAGENT, and pathway ligands/inhibitors/activators should usually include SIGNALING_MODULATOR.",
      "Use finer semantic tags when evidence is clear, such as OSTEOCLAST_DIFFERENTIATION_REAGENT, BONE_REMODELING_SIGNAL, IMMUNE_CYTOKINE_REAGENT, OSTEOGENIC_DIFFERENTIATION_REAGENT, ECM_COATING_REAGENT, STEM_CELL_MATRIX.",
      "Bioactive reagents such as recombinant proteins, cytokines, growth factors, enzymes, plasmids, viral vectors, siRNA/shRNA and CRISPR reagents should prefer category=BIOLOGICAL.",
      "Example: Soluble RANK Ligand (sRANKL) Protein, Recombinant human -> category=BIOLOGICAL, subCategory=Recombinant Protein.",
      "If reagent is transfection reagent (e.g., Lipofectamine), prefer category=CHEMICAL or KIT.",
      retrievalSummary,
      "Prefer project knowledge candidates when evidence is strong, unless the product name clearly contradicts them.",
    ].join(" ");
  }
  return [
    "你是生物医学试剂整理助手。",
    "必须仅返回严格 JSON，不要输出 markdown 或解释文本。",
    "category 只允许：ANTIBODY, BUFFER, KIT, PRIMER, BIOLOGICAL, CHEMICAL, CONSUMABLE, OTHER。",
    "字段必须是：category, subCategory, vendor, confidence, warnings, experimentTags, antibodyMeta, primerMeta。",
    `subCategory 若适用，优先使用这些标准值：${subCategoryList}。`,
    `experimentTags 只能从以下固定词表中选择：${tagList}。`,
    "antibodyMeta.role 必须使用大写 PRIMARY 或 SECONDARY。",
    "若为引物/探针，请填写 primerMeta.targetName 与 primerMeta.isReferenceGene。",
    "若为抗体，请填写 antibodyMeta.role、antibodyMeta.hostSpecies、antibodyMeta.targetSpecies、antibodyMeta.targetName。",
    "常见试剂请映射到标准标签，例如 DMEM->CELL_CULTURE_MEDIUM，FBS->SERUM_SUPPLEMENT，puromycin->SELECTION_ANTIBIOTIC，Lipofectamine 3000->TRANSFECTION_REAGENT，RIPA->WB_LYSIS_BUFFER，PVDF 膜->WB_TRANSFER_MEMBRANE，BCA 试剂盒->PROTEIN_QUANTIFICATION_REAGENT，TRIzol->RNA_EXTRACTION_REAGENT，质粒小提试剂盒->PLASMID_PREP_REAGENT，PFA->FIXATIVE，Triton X-100->PERMEABILIZATION_REAGENT，DAPI->NUCLEAR_STAIN，抗淬灭封片液->MOUNTING_MEDIUM，ExoQuick->EXOSOME_ISOLATION_REAGENT。",
    "对生物活性配体、重组细胞因子、生长因子、激素等，通常补充 CELL_STIMULATION_REAGENT；对配体/抑制剂/激动剂等通路调节试剂，通常补充 SIGNALING_MODULATOR。",
    "若证据充分，应进一步输出更细的实验语义标签，例如 OSTEOCLAST_DIFFERENTIATION_REAGENT、BONE_REMODELING_SIGNAL、IMMUNE_CYTOKINE_REAGENT、OSTEOGENIC_DIFFERENTIATION_REAGENT、ECM_COATING_REAGENT、STEM_CELL_MATRIX。",
    "对重组蛋白、细胞因子、生长因子、酶、质粒/病毒载体、siRNA/shRNA、CRISPR 试剂等生物活性试剂，优先归类为 BIOLOGICAL，并给出标准 subCategory。",
    "示例：Soluble RANK Ligand (sRANKL) Protein, Recombinant human -> category=BIOLOGICAL, subCategory=Recombinant Protein。",
    "若为转染试剂（如 Lipofectamine），优先归类 CHEMICAL 或 KIT。",
    retrievalSummary,
    "若项目知识库已给出强证据候选，应优先参考这些候选，除非商品名本身明显冲突。",
  ].join(" ");
}
