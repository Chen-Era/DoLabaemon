import type {
  ExperimentTechnique,
  TechniqueSearchMatch,
} from "@/lib/experiment-techniques/types";

export type TechniqueSearchFilters = {
  category?: string;
  sample?: string;
  readout?: string;
  risk?: string;
  evidenceTier?: string;
};

type IndexedTechnique = {
  technique: ExperimentTechnique;
  code: string;
  slug: string;
  identifierCode: string;
  identifierSlug: string;
  names: string[];
  aliases: string[];
  searchable: string;
};

type SearchQuery = {
  normalized: string;
  compact: string;
  identifier: string;
  tokens: string[];
};

function normalize(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/[‐‑‒–—―]/g, "-")
    .replace(/[^\p{L}\p{N}-]+/gu, " ")
    .trim();
}

function compact(value: string) {
  return normalize(value).replace(/[^\p{L}\p{N}-]+/gu, "");
}

// Codes conventionally use underscores, while users commonly write the same
// method with hyphens. This normalization is deliberately restricted to code
// and slug matching: aliases must retain hyphens so, for example, Hi-C does
// not collide with the HIC chromatography abbreviation.
function compactIdentifier(value: string) {
  return normalize(value).replace(/[^\p{L}\p{N}]+/gu, "");
}

function tokens(value: string) {
  return normalize(value).split(/\s+/).filter(Boolean);
}

function normalizeSearchQuery(query: string): SearchQuery {
  return {
    normalized: normalize(query),
    compact: compact(query),
    identifier: compactIdentifier(query),
    tokens: tokens(query),
  };
}

function calculateScore(query: SearchQuery, item: IndexedTechnique): TechniqueSearchMatch | null {
  if (!query.normalized) {
    return { technique: item.technique, score: 0, exact: false, evidence: [] };
  }

  if (
    query.identifier === item.identifierCode ||
    query.identifier === item.identifierSlug
  ) {
    return {
      technique: item.technique,
      score: 1000,
      exact: true,
      evidence: ["exact-code"],
    };
  }

  if (item.names.includes(query.compact)) {
    return {
      technique: item.technique,
      score: 980,
      exact: true,
      evidence: ["exact-name"],
    };
  }

  if (item.aliases.includes(query.compact)) {
    return {
      technique: item.technique,
      score: 960,
      exact: true,
      evidence: ["exact-alias"],
    };
  }

  const allTokensPresent = query.tokens.every((token) => item.searchable.includes(token));
  if (!allTokensPresent) return null;

  const namePrefix = item.names.some((name) => name.startsWith(query.compact));
  const aliasPrefix = item.aliases.some((alias) => alias.startsWith(query.compact));
  const compactSearch = item.searchable.replace(/\s+/g, "");
  const containment = compactSearch.includes(query.compact);
  const score = Math.min(
    (namePrefix ? 720 : 0) +
      (aliasPrefix ? 680 : 0) +
      (containment ? 300 : 0) +
      query.tokens.length * 25 -
      Math.min(item.searchable.length, 300) / 100,
    899,
  );

  return {
    technique: item.technique,
    score,
    exact: false,
    evidence: [
      ...(namePrefix ? ["name-prefix"] : []),
      ...(aliasPrefix ? ["alias-prefix"] : []),
      ...(containment ? ["contains"] : []),
      "all-query-tokens",
    ],
  };
}

export function createTechniqueSearchIndex(techniques: ExperimentTechnique[]) {
  const index: IndexedTechnique[] = techniques.map((technique) => {
    const names = [technique.name.zh, technique.name.en].map(compact);
    const aliases = technique.aliases.map(compact);
    return {
      technique,
      code: compact(technique.code),
      slug: compact(technique.slug),
      identifierCode: compactIdentifier(technique.code),
      identifierSlug: compactIdentifier(technique.slug),
      names,
      aliases,
      searchable: normalize(
        [
          technique.code,
          technique.slug,
          technique.name.zh,
          technique.name.en,
          ...technique.aliases,
          ...technique.sampleTypes,
          ...technique.readoutModes,
        ].join(" "),
      ),
    };
  });

  return {
    search(
      query: string,
      filters: TechniqueSearchFilters = {},
      evidenceTiersByTechnique: Map<string, Set<string>> = new Map(),
    ) {
      const normalizedQuery = normalizeSearchQuery(query);
      return index
        .filter(({ technique }) => {
          if (filters.category && technique.categoryCode !== filters.category) return false;
          if (
            filters.sample &&
            !technique.sampleTypes.some((value) =>
              normalize(value).includes(normalize(filters.sample ?? "")),
            )
          ) {
            return false;
          }
          if (
            filters.readout &&
            !technique.readoutModes.some((value) =>
              normalize(value).includes(normalize(filters.readout ?? "")),
            )
          ) {
            return false;
          }
          if (filters.risk && technique.safety.riskLevel !== filters.risk) return false;
          if (
            filters.evidenceTier &&
            !evidenceTiersByTechnique.get(technique.code)?.has(filters.evidenceTier)
          ) {
            return false;
          }
          return true;
        })
        .map((item) => calculateScore(normalizedQuery, item))
        .filter((match): match is TechniqueSearchMatch => Boolean(match))
        .sort(
          (left, right) =>
            right.score - left.score ||
            left.technique.code.localeCompare(right.technique.code, "en"),
        );
    },
  };
}

export function resolveTechniqueCandidates(
  techniques: ExperimentTechnique[],
  query: string,
  limit = 8,
) {
  const candidates = createTechniqueSearchIndex(techniques).search(query).slice(0, limit);
  const exactCandidates = candidates.filter((candidate) => candidate.exact);
  const selectableExactCandidates = exactCandidates.filter(
    (candidate) => !candidate.technique.isAbstract,
  );
  return {
    candidates,
    autoSelectedCode:
      selectableExactCandidates.length === 1 &&
      candidates[0]?.technique.code === selectableExactCandidates[0].technique.code
        ? selectableExactCandidates[0].technique.code
        : null,
    requiresHumanSelection: selectableExactCandidates.length !== 1,
  };
}
