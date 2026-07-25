import { searchReagentWeb, type ReagentSearchConfig, type ReagentSearchResult } from "@/lib/reagent-ingest/web-search";

export async function searchWebMcpTool(input: {
  query: string;
  config?: ReagentSearchConfig;
}): Promise<ReagentSearchResult[]> {
  return searchReagentWeb(input.query, input.config);
}
