import { cleanUrlText } from "@/lib/url/clean-url";

export type ReagentSearchResult = {
  title: string;
  url: string;
  snippet: string;
  domain: string;
};

export type ReagentSearchConfig = {
  enabled?: boolean;
  provider?: string | null;
  apiKey?: string | null;
  baseURL?: string | null;
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

function isSearchEnabled(config?: ReagentSearchConfig) {
  if (typeof config?.enabled === "boolean") return config.enabled;
  return process.env.REAGENT_SEARCH_ENABLED !== "false";
}

function getConfiguredProvider(config?: ReagentSearchConfig): SearchProvider | null {
  const provider = cleanText(config?.provider ?? process.env.REAGENT_SEARCH_PROVIDER).toLowerCase();
  if (provider === "tavily" || provider === "serper") return provider;
  return null;
}

async function searchWithTavily(query: string, apiKey: string, baseURL?: string | null): Promise<ReagentSearchResult[]> {
  const resolvedBaseUrl = cleanUrlText(baseURL) ?? cleanUrlText(process.env.REAGENT_SEARCH_BASE_URL) ?? "https://api.tavily.com/search";
  const response = await fetch(resolvedBaseUrl, {
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

async function searchWithSerper(query: string, apiKey: string, baseURL?: string | null): Promise<ReagentSearchResult[]> {
  const resolvedBaseUrl = cleanUrlText(baseURL) ?? cleanUrlText(process.env.REAGENT_SEARCH_BASE_URL) ?? "https://google.serper.dev/search";
  const response = await fetch(resolvedBaseUrl, {
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

export function isExternalSearchConfigured(config?: ReagentSearchConfig) {
  return Boolean(isSearchEnabled(config) && getConfiguredProvider(config) && cleanText(config?.apiKey ?? process.env.REAGENT_SEARCH_API_KEY));
}

export async function searchReagentWeb(query: string, config?: ReagentSearchConfig): Promise<ReagentSearchResult[]> {
  if (!isSearchEnabled(config)) return [];

  const provider = getConfiguredProvider(config);
  const apiKey = cleanText(config?.apiKey ?? process.env.REAGENT_SEARCH_API_KEY);
  const baseURL = cleanUrlText(config?.baseURL ?? process.env.REAGENT_SEARCH_BASE_URL);
  if (!provider || !apiKey || !cleanText(query)) {
    return [];
  }

  const results = provider === "tavily" ? await searchWithTavily(query, apiKey, baseURL) : await searchWithSerper(query, apiKey, baseURL);
  return dedupeResults(results);
}
