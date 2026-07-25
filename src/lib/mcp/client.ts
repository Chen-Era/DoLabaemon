import { fetchPagesMcpTool } from "@/lib/mcp/servers/fetch-server";
import { searchWebMcpTool } from "@/lib/mcp/servers/search-server";
import { selfCheckMcpTool } from "@/lib/mcp/servers/self-check-server";

type ToolInputMap = {
  search_web: Parameters<typeof searchWebMcpTool>[0];
  fetch_pages: Parameters<typeof fetchPagesMcpTool>[0];
  self_check_result: Parameters<typeof selfCheckMcpTool>[0];
};

type ToolOutputMap = {
  search_web: Awaited<ReturnType<typeof searchWebMcpTool>>;
  fetch_pages: Awaited<ReturnType<typeof fetchPagesMcpTool>>;
  self_check_result: Awaited<ReturnType<typeof selfCheckMcpTool>>;
};

export async function invokeMcpTool<T extends keyof ToolInputMap>(toolName: T, input: ToolInputMap[T]): Promise<ToolOutputMap[T]> {
  switch (toolName) {
    case "search_web":
      return searchWebMcpTool(input as ToolInputMap["search_web"]) as Promise<ToolOutputMap[T]>;
    case "fetch_pages":
      return fetchPagesMcpTool(input as ToolInputMap["fetch_pages"]) as Promise<ToolOutputMap[T]>;
    case "self_check_result":
      return selfCheckMcpTool(input as ToolInputMap["self_check_result"]) as Promise<ToolOutputMap[T]>;
    default:
      throw new Error(`UNKNOWN_MCP_TOOL_${String(toolName)}`);
  }
}
