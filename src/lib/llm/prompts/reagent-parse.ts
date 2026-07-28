import { experimentTags } from "@/lib/rules/catalog";
import { standardSubCategories } from "@/lib/reagent-tagging";
import { buildReagentStructuredOutputContract } from "@/lib/skills/builtin/reagent-parse-output";
import { buildVendorNormalizationInstruction } from "@/lib/vendor-normalization";

type RetrievalPromptContext = {
  candidateCategories?: string[];
  candidateSubCategories?: string[];
  candidateExperimentTags?: string[];
  evidenceLines?: string[];
};

function previewText(text: string | undefined, limit: number) {
  const normalized = (text ?? "").trim();
  return normalized.length <= limit ? normalized : `${normalized.slice(0, limit)}...`;
}

// 结构化输出技能被关闭时的精简契约：只保证字段合法，
// 不包含技能携带的映射经验与语义标签指引。
function buildCompactOutputContract(lang: "zh" | "en", context: { tagList: string; subCategoryList: string }) {
  if (lang === "en") {
    return [
      "Return STRICT JSON only. Do not add markdown or explanations.",
      "Allowed category: ANTIBODY, BUFFER, KIT, PRIMER, BIOLOGICAL, CHEMICAL, CONSUMABLE, OTHER.",
      "Keys must be: category, subCategory, vendor, confidence, warnings, experimentTags, antibodyMeta, primerMeta.",
      `subCategory should prefer these standard values when applicable: ${context.subCategoryList}.`,
      `experimentTags must be chosen from: ${context.tagList}.`,
      "Use uppercase antibody roles: PRIMARY or SECONDARY.",
      "Antibody tag rule: when category=ANTIBODY and antibodyMeta.role=PRIMARY, include WB_PRIMARY_ANTIBODY at minimum. Never add a PRIMARY antibody tag when antibodyMeta.role=SECONDARY; add IF/FLOW/ELISA antibody tags only when supported by product evidence.",
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
  ].join(" ");
}

export function buildReagentParsePrompt(
  lang: "zh" | "en",
  retrievalContext?: RetrievalPromptContext,
  options?: { structuredOutput?: boolean },
) {
  const tagList = experimentTags.join(", ");
  const subCategoryList = standardSubCategories.join(", ");
  const candidateCategories = retrievalContext?.candidateCategories?.slice(0, 4);
  const candidateSubCategories = retrievalContext?.candidateSubCategories?.slice(0, 6);
  const candidateExperimentTags = retrievalContext?.candidateExperimentTags?.slice(0, 8);
  const evidenceLines = retrievalContext?.evidenceLines?.slice(0, 4).map((item) => previewText(item, 160));
  const retrievalSummary = retrievalContext
    ? [
        candidateCategories?.length ? `Candidate categories: ${candidateCategories.join(", ")}.` : null,
        candidateSubCategories?.length
          ? `Candidate subCategories: ${candidateSubCategories.join(", ")}.`
          : null,
        candidateExperimentTags?.length
          ? `Candidate experimentTags: ${candidateExperimentTags.join(", ")}.`
          : null,
        evidenceLines?.length ? `Evidence: ${evidenceLines.join(" | ")}.` : null,
      ]
        .filter(Boolean)
        .join(" ")
    : "";
  const outputContract =
    options?.structuredOutput ?? true
      ? buildReagentStructuredOutputContract(lang, { tagList, subCategoryList })
      : buildCompactOutputContract(lang, { tagList, subCategoryList });
  const roleLine = lang === "en" ? "You are a biomedical reagent curator." : "你是生物医学试剂整理助手。";
  const knowledgePreferenceLine =
    lang === "en"
      ? "Prefer project knowledge candidates when evidence is strong, unless the product name clearly contradicts them."
      : "若项目知识库已给出强证据候选，应优先参考这些候选，除非商品名本身明显冲突。";
  return [roleLine, outputContract, buildVendorNormalizationInstruction(lang), retrievalSummary, knowledgePreferenceLine]
    .filter(Boolean)
    .join(" ");
}
