type VerificationPageInput = {
  title: string;
  url: string;
  domain: string;
  snippet: string;
  excerpt: string;
};

type ReagentVerificationPromptInput = {
  lang: "zh" | "en";
  verificationMethod: "native_web_search" | "external_search" | "none";
  initialDraft?: unknown;
  retrievalEvidence?: string[];
  externalEvidence?: VerificationPageInput[];
};

function previewText(text: string | undefined, limit: number) {
  const normalized = (text ?? "").trim();
  return normalized.length <= limit ? normalized : `${normalized.slice(0, limit)}...`;
}

function stringifyEvidence(evidence: VerificationPageInput[] | undefined) {
  if (!evidence?.length) return "None.";
  return evidence
    .slice(0, 2)
    .map(
      (item, index) =>
        `[${index + 1}] ${previewText(item.title, 120) || "Untitled"} | ${item.domain} | ${item.url}\nSnippet: ${previewText(item.snippet, 220) || "N/A"}\nExcerpt: ${previewText(item.excerpt, 600) || "N/A"}`,
    )
    .join("\n\n");
}

export function buildReagentVerifyPrompt(input: ReagentVerificationPromptInput) {
  const retrievalSummary = input.retrievalEvidence?.length ? input.retrievalEvidence.join(" | ") : "None.";
  const candidateDraft = input.initialDraft ? JSON.stringify(input.initialDraft) : "null";
  const externalSummary = stringifyEvidence(input.externalEvidence);

  if (input.lang === "en") {
    return [
      "You are a biomedical reagent verification assistant.",
      "Return STRICT JSON only with keys: category, subCategory, vendor, confidence, warnings, experimentTags, antibodyMeta, primerMeta, verification.",
      'verification must contain keys: status, method, reason, warnings.',
      `verification.method must be "${input.verificationMethod}".`,
      'verification.reason must be one of: verified, native_tool_unavailable, native_search_no_sources, external_search_unconfigured, external_search_failed, external_search_no_results, verification_model_failed, fallback_used.',
      'verification.status must be "verified" only when web evidence clearly supports the corrected result; otherwise use "unverified".',
      "Keep project taxonomy stable. Prefer local retrieval evidence for category and semantic tags unless web evidence clearly contradicts it.",
      "Correct vendor, catalog number consistency, product naming, antibody metadata and primer metadata when evidence is strong.",
      "If evidence conflicts or is weak, keep the conservative result and add warnings instead of over-correcting.",
      `Initial structured draft: ${candidateDraft}.`,
      `Local retrieval evidence: ${retrievalSummary}.`,
      `External evidence: ${externalSummary}.`,
    ].join(" ");
  }

  return [
    "你是生物医学试剂联网核验助手。",
    "必须仅返回严格 JSON，字段只能是：category, subCategory, vendor, confidence, warnings, experimentTags, antibodyMeta, primerMeta, verification。",
    "verification 内必须包含：status, method, reason, warnings。",
    `verification.method 必须固定为 "${input.verificationMethod}"。`,
    "verification.reason 必须是以下固定枚举之一：verified、native_tool_unavailable、native_search_no_sources、external_search_unconfigured、external_search_failed、external_search_no_results、verification_model_failed、fallback_used。",
    '只有当联网证据足以支持最终结果时，verification.status 才能写为 "verified"，否则必须写 "unverified"。',
    "分类语义优先保持与项目本地知识库一致；只有在外部证据非常明确时，才纠正 category、subCategory 与实验标签。",
    "对厂家、货号一致性、商品名、抗体元数据、引物元数据做逐项核验；证据强时纠偏，证据弱时保守输出并写 warning。",
    `初始结构化草稿：${candidateDraft}。`,
    `本地检索证据：${retrievalSummary}。`,
    `外部证据：${externalSummary}。`,
  ].join(" ");
}
