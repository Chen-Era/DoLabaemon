import type { ReagentKnowledgeEntry } from "@/lib/reagent-knowledge/types";

export function normalizeKnowledgeText(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

export function scoreKnowledgeEntry(entry: ReagentKnowledgeEntry, searchText: string) {
  const lowered = searchText.toLowerCase();
  const normalized = normalizeKnowledgeText(searchText);
  const evidence: string[] = [];
  let score = 0;

  for (const alias of entry.aliases) {
    const normalizedAlias = normalizeKnowledgeText(alias);
    if (!normalizedAlias) continue;
    if (normalized === normalizedAlias) {
      score += 100;
      evidence.push(`exact alias:${alias}`);
    } else if (normalized.includes(normalizedAlias)) {
      score += 45;
      evidence.push(`alias:${alias}`);
    }
  }

  for (const pattern of entry.namePatterns) {
    const regex = new RegExp(pattern, "i");
    if (regex.test(lowered)) {
      score += 30;
      evidence.push(`pattern:${pattern}`);
    }
  }

  for (const keyword of entry.requiredKeywords) {
    const normalizedKeyword = normalizeKnowledgeText(keyword);
    if (normalizedKeyword && normalized.includes(normalizedKeyword)) {
      score += 12;
      evidence.push(`required:${keyword}`);
    }
  }

  for (const keyword of entry.excludedKeywords) {
    const normalizedKeyword = normalizeKnowledgeText(keyword);
    if (normalizedKeyword && normalized.includes(normalizedKeyword)) {
      score -= 80;
      evidence.push(`excluded:${keyword}`);
    }
  }

  return { score, evidence };
}
