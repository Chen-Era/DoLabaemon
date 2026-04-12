export function buildReagentBatchExtractPrompt(lang: "zh" | "en") {
  if (lang === "en") {
    return [
      "You extract reagent rows from pasted raw text or OCR text.",
      "Return STRICT JSON array only. No markdown.",
      "Each array item must contain: sourceText, name, vendor, catalogNo, note, antibodyCompatibilityText.",
      "Ignore blank lines, obvious table headers, numbering noise, and non-reagent chatter.",
      "If one row contains several fields, preserve them in sourceText and map fields when possible.",
      "If a field is missing, return null for that field.",
      "Use the product/reagent name as name. Do not invent missing catalog numbers.",
      "For antibody host/species compatibility phrases, keep the original wording in antibodyCompatibilityText.",
      "When OCR text is messy, prefer splitting conservatively instead of merging unrelated reagents.",
    ].join(" ");
  }

  return [
    "你是试剂批量录入的文本抽取助手。",
    "必须只返回严格 JSON 数组，不要输出 markdown 或解释。",
    "数组每一项必须包含：sourceText, name, vendor, catalogNo, note, antibodyCompatibilityText。",
    "忽略空行、明显表头、序号噪声和与试剂无关的说明文本。",
    "如果一行里混有多个字段，请尽量拆出名称、厂家、货号、备注。",
    "字段缺失时返回 null，不要编造货号或厂家。",
    "name 必须是试剂/商品名称。",
    "抗体宿主、适用种属、兼容性等原始表述优先保留到 antibodyCompatibilityText。",
    "面对 OCR 错位文本时，宁可保守拆成多条候选，也不要把无关内容硬拼成一条。",
  ].join(" ");
}
