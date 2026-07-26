import { NextResponse } from "next/server";
import { z } from "zod";
import { generateLlmText, getLlmClient } from "@/lib/llm/client";
import { getRuntimeLlmConfigForUser } from "@/lib/llm/runtime-config";
import { requireUserFromRequest } from "@/lib/session";
import { searchReagentWeb } from "@/lib/reagent-ingest/web-search";
import { listRuntimeMcpServers } from "@/lib/mcp/registry";
import { loadServerPublishedSkills } from "@/lib/skills/loaders";
import { cleanUrlText } from "@/lib/url/clean-url";

const schema = z.object({
  openaiApiKey: z.string().optional(),
  openaiBaseUrl: z.string().optional(),
  openaiModel: z.string().optional(),
  searchEnabled: z.boolean().default(true),
  searchProvider: z.string().optional(),
  searchApiKey: z.string().optional(),
  searchBaseUrl: z.string().optional(),
  enabledSkills: z.array(z.string()).default([]),
  enabledMcpServers: z.array(z.string()).default([]),
  selfCheckEnabled: z.boolean().default(true),
  autoLearnEnabled: z.boolean().default(false),
  thinkingEnabled: z.boolean().default(false),
  knowledgeVerifySkipEnabled: z.boolean().default(true),
});

function cleanText(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function POST(req: Request) {
  try {
    const user = await requireUserFromRequest(req);
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", code: "INVALID_PAYLOAD" }, { status: 400 });
    }

    const input = parsed.data;
    const runtime = await getRuntimeLlmConfigForUser(user.id);
    const modelResult: { ok: boolean; message: string } = { ok: false, message: "未测试" };
    const searchResult: { ok: boolean; message: string } = { ok: false, message: "未测试" };

    const apiKey = cleanText(input.openaiApiKey) ?? cleanText(runtime.apiKey ?? undefined);
    const model = cleanText(input.openaiModel) ?? cleanText(runtime.model);
    const baseURL = cleanUrlText(input.openaiBaseUrl) ?? cleanUrlText(runtime.baseURL ?? undefined);

    if (!apiKey) {
      modelResult.message = "未填写模型 API Key";
    } else if (!model) {
      modelResult.message = "未填写文本模型名";
    } else {
      try {
        const client = getLlmClient({ apiKey, baseURL });
        const response = await generateLlmText(client, { baseURL, thinkingEnabled: input.thinkingEnabled }, {
          model,
          input: [{ role: "user", content: "Return exactly OK." }],
          temperature: 0,
        });
        const text = response.text?.trim();
        modelResult.ok = Boolean(text);
        modelResult.message = text ? `模型接口连通，返回：${text.slice(0, 80)}` : "模型接口可达，但未返回文本";
      } catch (error) {
        modelResult.message = error instanceof Error ? error.message : String(error);
      }
    }

    const searchEnabled = input.searchEnabled ?? runtime.searchEnabled;
    if (!searchEnabled) {
      searchResult.ok = true;
      searchResult.message = "已关闭联网搜索";
    } else {
      const provider = cleanText(input.searchProvider) ?? cleanText(runtime.searchProvider ?? undefined);
      const searchApiKey = cleanText(input.searchApiKey) ?? cleanText(runtime.searchApiKey ?? undefined);
      const searchBaseUrl = cleanUrlText(input.searchBaseUrl) ?? cleanUrlText(runtime.searchBaseURL ?? undefined);
      if (!provider || !searchApiKey) {
        searchResult.message = "未填写搜索 provider 或搜索 API Key";
      } else {
        try {
          const results = await searchReagentWeb("BMP2 recombinant protein", {
            enabled: searchEnabled,
            provider,
            apiKey: searchApiKey,
            baseURL: searchBaseUrl,
          });
          searchResult.ok = true;
          searchResult.message = results.length ? `搜索接口连通，拿到 ${results.length} 条结果` : "搜索接口连通，但未返回结果";
        } catch (error) {
          searchResult.message = error instanceof Error ? error.message : String(error);
        }
      }
    }

    const skills = loadServerPublishedSkills();
    const mcpServers = listRuntimeMcpServers();

    return NextResponse.json({
      model: modelResult,
      search: searchResult,
      skills: {
        ok: true,
        message: `已加载 ${skills.length} 个服务器 skill`,
      },
      mcp: {
        ok: true,
        message: `已注册 ${mcpServers.length} 个 MCP server`,
      },
      ok: modelResult.ok && searchResult.ok,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }
    return NextResponse.json({ error: "Test connection failed", code: "TEST_CONNECTION_FAILED" }, { status: 500 });
  }
}
