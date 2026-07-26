/**
 * Prompt for fuzzy experiment-name matching against the published technique
 * catalog. The model may return several candidate codes but must never invent
 * codes outside the provided digest.
 */
export function buildTechniqueAiMatchPrompt(lang: "zh" | "en", catalogDigest: string) {
  if (lang === "en") {
    return [
      "You are a biomedical experiment curator helping users find existing experiment techniques.",
      "Return STRICT JSON only. Do not add markdown or explanations.",
      "The complete list of selectable techniques is given below as catalog lines.",
      "Each line has the shape: CODE | Chinese name | English name | aliases | category | scope summary.",
      "Catalog:",
      catalogDigest,
      "Rules:",
      "1. The user input may be fuzzy, abbreviated, bilingual, or describe the experiment purpose rather than its name.",
      "2. Match it against the catalog and return every plausible existing technique, ordered from most to least likely.",
      "3. You may return multiple candidates when the input is ambiguous; return exactly one when it clearly maps to a single technique.",
      "4. Only use CODE values that appear verbatim in the catalog above. Never invent or modify codes.",
      "5. Do not return abstract/parent categories when a concrete leaf technique fits better.",
      "6. If nothing in the catalog is a reasonable match, return an empty matches array instead of guessing.",
      "7. Be conservative with confidence: 0.9+ only for near-exact matches, 0.6-0.9 for strong semantic matches, below 0.6 for weak guesses.",
      'Output JSON shape: {"matches":[{"code":"...","confidence":0.0-1.0,"rationale":"short reason"}],"notes":"optional caveat or empty string"}.',
      "Keep each rationale under 80 characters and write rationales in Chinese.",
    ].join("\n");
  }

  return [
    "你是生物医学实验整理助手，帮助用户从已有实验技术目录中找到目标技术。",
    "必须只返回严格 JSON，不要输出 markdown 或解释。",
    "下方目录列出了全部可选技术，每行格式为：CODE | 中文名 | 英文名 | 别名 | 分类 | 适用范围摘要。",
    "目录：",
    catalogDigest,
    "规则：",
    "1. 用户输入可能是模糊、缩写、中英文混写，或只描述实验目的而非正式名称。",
    "2. 请与目录比对，按可能性从高到低返回所有合理的已有技术。",
    "3. 输入有歧义时应返回多个候选；能明确对应单一技术时只返回一个。",
    "4. 只能逐字使用上方目录中出现的 CODE，绝不允许编造或改写。",
    "5. 当具体叶子技术更合适时，不要返回抽象/父级分类。",
    "6. 如果目录中没有合理匹配，返回空 matches 数组，不要硬猜。",
    "7. confidence 要保守：接近完全命中才给 0.9 以上；强语义匹配 0.6-0.9；弱猜测低于 0.6。",
    '输出 JSON 结构：{"matches":[{"code":"...","confidence":0.0-1.0,"rationale":"简短理由"}],"notes":"可选备注或空字符串"}。',
    "每条 rationale 用中文书写，不超过 80 字。",
  ].join("\n");
}
