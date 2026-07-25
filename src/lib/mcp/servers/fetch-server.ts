import { fetchVerificationPages, type VerificationPage } from "@/lib/reagent-ingest/fetch-verification-pages";
import type { ReagentSearchResult } from "@/lib/reagent-ingest/web-search";

export async function fetchPagesMcpTool(input: {
  results: ReagentSearchResult[];
  limit?: number;
}): Promise<VerificationPage[]> {
  return fetchVerificationPages(input.results, input.limit);
}
