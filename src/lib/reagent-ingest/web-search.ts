export type ReagentSearchResult = {
  title: string;
  url: string;
  snippet: string;
  domain: string;
};

type SearchProvider = "tavily" | "serper";

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function buildDomain(url: string) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function isSearchEnabled() {
  return process.env.REAGENT_SEARCH_ENABLED !== "false";
}

function getConfiguredProvider(): SearchProvider | null {
  const provider = cleanText(process.env.REAGENT_SEARCH_PROVIDER).toLowerCase();
  if (provider === "tavily" || provider === "serper") return provider;
  return null;
}

async function searchWithTavily(query: string, apiKey: string): Promise<ReagentSearchResult[]> {
  const response = await fetch(process.env.REAGENT_SEARCH_BASE_URL || "https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      topic: "general",
      search_depth: "advanced",
      max_results: 5,
      include_raw_content: false,
    }),
    signal: AbortSignal.timeout(12000),
  });

  if (!response.ok) {
    throw new Error(`TAVILY_SEARCH_FAILED_${response.status}`);
  }

  const data = (await response.json()) as {
    results?: Array<{ title?: string; url?: string; content?: string }>;
  };

  return (data.results ?? [])
    .map((item) => {
      const url = cleanText(item.url);
      return {
        title: cleanText(item.title),
        url,
        snippet: cleanText(item.content),
        domain: buildDomain(url),
      };
    })
    .filter((item) => item.url);
}

async function searchWithSerper(query: string, apiKey: string): Promise<ReagentSearchResult[]> {
  const response = await fetch(process.env.REAGENT_SEARCH_BASE_URL || "https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": apiKey,
    },
    body: JSON.stringify({
      q: query,
      num: 5,
      gl: "us",
    }),
    signal: AbortSignal.timeout(12000),
  });

  if (!response.ok) {
    throw new Error(`SERPER_SEARCH_FAILED_${response.status}`);
  }

  const data = (await response.json()) as {
    organic?: Array<{ title?: string; link?: string; snippet?: string }>;
  };

  return (data.organic ?? [])
    .map((item) => {
      const url = cleanText(item.link);
      return {
        title: cleanText(item.title),
        url,
        snippet: cleanText(item.snippet),
        domain: buildDomain(url),
      };
    })
    .filter((item) => item.url);
}

function dedupeResults(results: ReagentSearchResult[]) {
  const seen = new Set<string>();
  return results.filter((item) => {
    if (!item.url || seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}

export function isExternalSearchConfigured() {
  return Boolean(isSearchEnabled() && getConfiguredProvider() && cleanText(process.env.REAGENT_SEARCH_API_KEY));
}

export async function searchReagentWeb(query: string): Promise<ReagentSearchResult[]> {
  if (!isSearchEnabled()) return [];

  const provider = getConfiguredProvider();
  const apiKey = cleanText(process.env.REAGENT_SEARCH_API_KEY);
  if (!provider || !apiKey || !cleanText(query)) {
    return [];
  }

  const results = provider === "tavily" ? await searchWithTavily(query, apiKey) : await searchWithSerper(query, apiKey);
  return dedupeResults(results);
}
