export const runtimeMcpServers = [
  {
    id: "search",
    name: "Search MCP",
    description: "统一封装外部联网搜索能力。",
    tools: ["search_web"],
  },
  {
    id: "fetch",
    name: "Fetch MCP",
    description: "抓取网页正文并提取可验证摘要。",
    tools: ["fetch_pages"],
  },
  {
    id: "self-check",
    name: "Self Check MCP",
    description: "对输出、来源和学习写回风险做规则化自检。",
    tools: ["self_check_result"],
  },
] as const;

export type RuntimeMcpServerId = (typeof runtimeMcpServers)[number]["id"];

export function listRuntimeMcpServers() {
  return [...runtimeMcpServers];
}

export function hasRuntimeMcpServer(serverId: string) {
  return runtimeMcpServers.some((item) => item.id === serverId);
}
