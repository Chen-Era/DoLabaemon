import type { ReagentSearchResult } from "@/lib/reagent-ingest/web-search";

export type VerificationPage = {
  title: string;
  url: string;
  domain: string;
  snippet: string;
  excerpt: string;
};

const blockedDomains = ["facebook.com", "x.com", "twitter.com", "youtube.com", "bilibili.com", "zhihu.com", "reddit.com"];

function decodeEntities(text: string) {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripHtml(html: string) {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " "),
  ).trim();
}

function rankResult(item: ReagentSearchResult) {
  const text = `${item.title} ${item.url} ${item.snippet}`.toLowerCase();
  let score = 0;
  if (/(product|products|datasheet|catalog|sku|reagent|antibody|protein|kit)/.test(text)) score += 4;
  if (/(abcam|cst|cellsignal|thermofisher|invitrogen|biolegend|sigma|merck|beyotime|yeasen|targetmol|medchemexpress)/.test(text)) score += 3;
  if (item.domain.split(".").length <= 3) score += 1;
  return score;
}

function shouldSkipDomain(domain: string) {
  return blockedDomains.some((blocked) => domain === blocked || domain.endsWith(`.${blocked}`));
}

function previewText(text: string, limit = 1800) {
  return text.length <= limit ? text : `${text.slice(0, limit)}...`;
}

export async function fetchVerificationPages(results: ReagentSearchResult[], limit = 3): Promise<VerificationPage[]> {
  const candidates = results
    .filter((item) => item.url && item.domain && !shouldSkipDomain(item.domain))
    .sort((a, b) => rankResult(b) - rankResult(a))
    .slice(0, limit);

  const pages = await Promise.all(
    candidates.map(async (item) => {
      try {
        const response = await fetch(item.url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; lab-reagent-system/1.0)",
          },
          signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) return null;
        const html = await response.text();
        const excerpt = previewText(stripHtml(html));
        if (!excerpt) return null;
        return {
          title: item.title,
          url: item.url,
          domain: item.domain,
          snippet: item.snippet,
          excerpt,
        };
      } catch {
        return null;
      }
    }),
  );

  return pages.filter((item): item is VerificationPage => Boolean(item));
}
