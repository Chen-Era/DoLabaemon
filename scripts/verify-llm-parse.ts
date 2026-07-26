/**
 * Smoke test: call the configured LLM end-to-end for reagent-name parsing.
 *
 * Usage: npx tsx scripts/verify-llm-parse.ts
 *
 * Reads credentials from .env, sends the production parse prompt for a few
 * well-known reagents, and verifies the reply parses via parseLlmJson +
 * reagentParsedSchema (the same path as src/lib/reagent-ingest/parse-reagent.ts).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile() {
  const content = readFileSync(resolve(process.cwd(), ".env"), "utf8");
  for (const line of content.split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2];
    }
  }
}

loadEnvFile();

const CASES = [
  { name: "DMEM 高糖培养基", catalogNo: "11965092", lang: "zh" as const },
  { name: "Lipofectamine 3000 Transfection Reagent", catalogNo: "L3000015", lang: "zh" as const },
];

async function main() {
  const { generateLlmText, getLlmClient } = await import("@/lib/llm/client");
  const { parseLlmJson } = await import("@/lib/llm/json-output");
  const { normalizeLlmParsedPayload } = await import("@/lib/llm/normalize");
  const { buildReagentParsePrompt } = await import("@/lib/llm/prompts/reagent-parse");
  const { reagentParsedSchema } = await import("@/lib/llm/schemas");

  const client = getLlmClient();
  const model = process.env.OPENAI_MODEL || "MiniMax-M1-80k";
  let failed = 0;

  for (const testCase of CASES) {
    const startedAt = Date.now();
    try {
      const result = await generateLlmText(client, { baseURL: process.env.OPENAI_BASE_URL, thinkingEnabled: process.env.LLM_THINKING_ENABLED === "true" }, {
        model,
        input: [
          { role: "system", content: buildReagentParsePrompt(testCase.lang) },
          { role: "user", content: JSON.stringify(testCase) },
        ],
        temperature: 0,
      });
      const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
      const hasThinkBlock = /<think/i.test(result.text);
      const parsed = reagentParsedSchema.parse(normalizeLlmParsedPayload(parseLlmJson(result.text)));
      console.log(
        `OK   ${testCase.name} | ${elapsed}s | think_in_content=${hasThinkBlock} | category=${parsed.category} | tags=${parsed.experimentTags.join(",")}`,
      );
    } catch (error) {
      failed += 1;
      console.error(`FAIL ${testCase.name} |`, error instanceof Error ? error.message : error);
    }
  }

  process.exit(failed ? 1 : 0);
}

main();
