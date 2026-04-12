import { experimentTags, experimentTypeCatalog } from "@/lib/rules/catalog";

type ExperimentResolvePromptContext = {
  candidateCodes?: string[];
  workflowHints?: string[];
  requiredTemplateHints?: string[];
  recommendedTemplateHints?: string[];
  evidenceLines?: string[];
};

export function buildExperimentResolvePrompt(lang: "zh" | "en", retrievalContext?: ExperimentResolvePromptContext) {
  const typeList = experimentTypeCatalog.map((item) => `${item.code}:${item.nameEn}`).join(", ");
  const tagList = experimentTags.join(", ");
  const retrievalSummary = retrievalContext
    ? [
        retrievalContext.candidateCodes?.length ? `Candidate codes: ${retrievalContext.candidateCodes.join(", ")}.` : null,
        retrievalContext.workflowHints?.length ? `Workflow hints: ${retrievalContext.workflowHints.join(", ")}.` : null,
        retrievalContext.requiredTemplateHints?.length
          ? `Required template hints: ${retrievalContext.requiredTemplateHints.join(", ")}.`
          : null,
        retrievalContext.recommendedTemplateHints?.length
          ? `Recommended template hints: ${retrievalContext.recommendedTemplateHints.join(", ")}.`
          : null,
        retrievalContext.evidenceLines?.length ? `Evidence: ${retrievalContext.evidenceLines.join(" | ")}.` : null,
      ]
        .filter(Boolean)
        .join(" ")
    : "";

  if (lang === "en") {
    return [
      "You are a biomedical experiment curator.",
      "Return STRICT JSON only. Do not add markdown or explanations.",
      "Supported experiment codes in this project are:",
      typeList + ".",
      "Your task is to map a manually entered experiment name to an existing code when evidence is strong.",
      "When evidence is weak, propose a candidate experiment template with workflow stages and reagent requirements.",
      "Only output reagent-related requirements. Do not output instruments, consumables, microscopes, plate readers or incubators as reagent items.",
      "Use matcherType from: TAG_ANY, NAME_ANY, ANTIBODY_TARGET_ANY, PRIMER_TARGET_ANY, PRIMER_REFERENCE.",
      `Prefer experiment tags already used in this project: ${tagList}.`,
      "Keys must be: proposedExperimentName, proposedExperimentCode, matchedExistingCode, workflowStages, minRequiredItems, recommendedItems, warnings, rationale, confidence.",
      "If an existing project experiment code is clearly correct, fill matchedExistingCode and keep proposedExperimentCode the same as that code or null.",
      "If you are not confident, keep matchedExistingCode null, propose a descriptive experiment name, add warnings, and set confidence conservatively.",
      "Follow academic conventions: minimum requirements should support the core assay readout; recommended items should improve quality or interpretation but not over-block.",
      retrievalSummary,
      "Prefer project knowledge candidates when evidence is strong, unless the manual name clearly contradicts them.",
    ].join(" ");
  }

  return [
    "你是生物医学实验类型整理助手。",
    "必须只返回严格 JSON，不要输出 markdown 或解释。",
    `本项目当前已支持的正式实验类型有：${typeList}。`,
    "你的任务是把手动输入的实验名称优先归一到已有实验类型；若证据不足，则生成候选实验类型模板。",
    "生成内容只允许包含试剂相关要求，不要把仪器、耗材、培养箱、显微镜、酶标仪等写成试剂项。",
    "matcherType 只能使用：TAG_ANY, NAME_ANY, ANTIBODY_TARGET_ANY, PRIMER_TARGET_ANY, PRIMER_REFERENCE。",
    `优先复用本项目已有 experimentTags：${tagList}。`,
    "字段必须是：proposedExperimentName, proposedExperimentCode, matchedExistingCode, workflowStages, minRequiredItems, recommendedItems, warnings, rationale, confidence。",
    "若与已有正式实验类型高度一致，应填写 matchedExistingCode。",
    "若证据不足，应保持 matchedExistingCode 为空，给出候选实验名称、流程阶段、最低必需试剂和推荐试剂，并保守设置 confidence。",
    "学术规范要求：最低必需项必须能支撑核心读出；推荐项用于提升质量、解释性或规范性，不要过度阻断。",
    retrievalSummary,
    "若项目知识资产给出强证据候选，应优先参考；但若手动输入与候选明显冲突，应保守输出 warning。",
  ].join(" ");
}
