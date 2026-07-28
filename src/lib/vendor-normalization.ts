type VendorAlias = {
  canonical: string;
  aliases: string[];
};

const vendorAliases: VendorAlias[] = [
  { canonical: "普诺赛 Procell", aliases: ["Procell", "普诺赛"] },
  { canonical: "雅酶 Epizyme", aliases: ["雅酶", "Epizyme"] },
  { canonical: "翌圣生物 Yeasen", aliases: ["Yeasen", "翌圣", "翌圣生物"] },
  { canonical: "索莱宝 Solarbio", aliases: ["Solarbio", "索莱宝"] },
  { canonical: "雷根 Leagene", aliases: ["Leagene", "雷根"] },
  { canonical: "源叶生物", aliases: ["源叶", "源叶生物"] },
  { canonical: "Cell Signaling Technology", aliases: ["CST", "Cell Signaling Technology"] },
  { canonical: "MedChemExpress", aliases: ["MCE", "MedChemExpress"] },
  { canonical: "Proteintech", aliases: ["Proteintech"] },
  { canonical: "Abcam", aliases: ["Abcam"] },
  { canonical: "Invitrogen", aliases: ["Invitrogen"] },
  { canonical: "Thermo Scientific", aliases: ["Thermo Scientific", "Thermo Fisher", "Thermo Fisher Scientific"] },
  { canonical: "Gibco", aliases: ["Gibco"] },
  { canonical: "伯仪生物 ACE", aliases: ["伯仪生物", "ACE", "ACE Biotechnology"] },
  { canonical: "吉凯基因 GeneChem", aliases: ["吉凯", "吉凯基因", "GeneChem"] },
  { canonical: "吉满生物 Genomeditech", aliases: ["吉满", "吉满生物", "Genomeditech"] },
  { canonical: "源井生物", aliases: ["源井", "源井生物"] },
  { canonical: "Cloud-Clone（云克隆）", aliases: ["武汉云克隆", "云克隆", "Cloud-Clone"] },
  { canonical: "BD", aliases: ["BD", "Becton Dickinson"] },
  { canonical: "Corning", aliases: ["Corning"] },
  { canonical: "Biosharp", aliases: ["Biosharp"] },
  { canonical: "Novoprotein", aliases: ["Novoprotein", "诺为泰"] },
  { canonical: "R&D Systems", aliases: ["R&D", "R&D Systems", "R and D Systems"] },
  { canonical: "Merck Millipore", aliases: ["Merck Millipore", "Millipore"] },
  { canonical: "Sigma-Aldrich", aliases: ["Sigma", "Sigma-Aldrich"] },
  { canonical: "BioLegend", aliases: ["BioLegend"] },
  { canonical: "TargetMol", aliases: ["TargetMol"] },
  { canonical: "Beyotime", aliases: ["Beyotime", "碧云天"] },
];

function cleanVendor(value?: string | null) {
  const cleaned = value?.trim().replace(/\s+/g, " ");
  return cleaned || null;
}

function vendorKey(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s_\-—–()（）\[\]【】{}<>/\\.,，、&+]+/g, "");
}

function aliasMatches(value: string, alias: string) {
  const valueKey = vendorKey(value);
  const aliasKey = vendorKey(alias);
  if (!valueKey || !aliasKey) return false;
  if (valueKey === aliasKey) return true;
  // Short abbreviations (such as CST / MCE / BD) must be a complete value to
  // avoid accidentally matching unrelated supplier names.
  return aliasKey.length >= 4 && valueKey.includes(aliasKey);
}

export function normalizeVendor(value?: string | null) {
  const cleaned = cleanVendor(value);
  if (!cleaned) return null;
  const matched = vendorAliases.find((entry) => entry.aliases.some((alias) => aliasMatches(cleaned, alias)));
  return matched?.canonical ?? cleaned;
}

/**
 * Supplier text copied from a structured brand column is more reliable than a
 * model guess. The model is still used to infer a missing brand from product
 * context, and both paths converge on the same canonical vocabulary.
 */
export function resolveNormalizedVendor(input: { rawVendor?: string | null; detectedVendor?: string | null }) {
  const rawVendor = cleanVendor(input.rawVendor);
  const detectedVendor = cleanVendor(input.detectedVendor);
  return normalizeVendor(rawVendor) ?? normalizeVendor(detectedVendor);
}

export function buildVendorNormalizationInstruction(lang: "zh" | "en") {
  const examples = [
    "普诺赛 / procell / Procell/普诺赛 -> 普诺赛 Procell",
    "雅酶 / Epizyme -> 雅酶 Epizyme",
    "Yeasen / 翌圣生物 -> 翌圣生物 Yeasen",
    "CST -> Cell Signaling Technology",
    "MCE -> MedChemExpress",
    "Solarbio / 索莱宝 -> 索莱宝 Solarbio",
    "Leagene / 雷根 -> 雷根 Leagene",
  ].join("; ");

  if (lang === "en") {
    return `Normalize the vendor to one stable canonical brand name. Use the supplied vendor field as the primary evidence; infer only when it is absent. Required examples: ${examples}.`;
  }
  return `必须将 vendor 统一为稳定的标准品牌名；优先采用输入中的原始品牌字段，仅在缺失时根据商品名和货号推断。固定映射示例：${examples}。`;
}
