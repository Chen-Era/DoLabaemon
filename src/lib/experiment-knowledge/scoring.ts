import type { ExperimentKnowledgeEntry } from "@/lib/experiment-knowledge/types";

export function normalizeExperimentText(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, " ").replace(/\s+/g, " ").trim();
}

export function scoreExperimentKnowledgeEntry(entry: ExperimentKnowledgeEntry, searchText: string, directionCode?: string) {
  const lowered = searchText.toLowerCase();
  const normalized = normalizeExperimentText(searchText);
  const evidence: string[] = [];
  let score = 0;

  if (normalizeExperimentText(entry.normalizedCode) === normalized) {
    score += 110;
    evidence.push(`code:${entry.normalizedCode}`);
  }

  for (const alias of [entry.canonicalName, ...entry.aliases]) {
    const normalizedAlias = normalizeExperimentText(alias);
    if (!normalizedAlias) continue;
    if (normalized === normalizedAlias) {
      score += 100;
      evidence.push(`exact alias:${alias}`);
    } else if (normalized.startsWith(normalizedAlias) || normalized.endsWith(normalizedAlias)) {
      score += 70;
      evidence.push(`phrase alias:${alias}`);
    } else if (normalized.includes(normalizedAlias)) {
      score += 45;
      evidence.push(`alias:${alias}`);
    }
  }

  for (const keyword of entry.evidenceKeywords) {
    const normalizedKeyword = normalizeExperimentText(keyword);
    if (normalizedKeyword && normalized.includes(normalizedKeyword)) {
      score += 15;
      evidence.push(`keyword:${keyword}`);
    }
  }

  for (const keyword of entry.excludedKeywords) {
    const normalizedKeyword = normalizeExperimentText(keyword);
    if (normalizedKeyword && normalized.includes(normalizedKeyword)) {
      score -= 80;
      evidence.push(`excluded:${keyword}`);
    }
  }

  if (directionCode && entry.supportedDirections.includes(directionCode)) {
    score += 10;
    evidence.push(`direction:${directionCode}`);
  }

  if (/\bsecret/i.test(lowered) && entry.normalizedCode === "ELISA") {
    score += 8;
    evidence.push("context:secreted analyte");
  }

  if (/\bcell\b|\bmarker\b|\bphenotyp/i.test(lowered) && entry.normalizedCode === "FLOW") {
    score += 8;
    evidence.push("context:cell marker");
  }

  return { score, evidence };
}
