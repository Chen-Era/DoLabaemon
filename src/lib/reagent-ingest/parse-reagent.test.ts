import test from "node:test";
import assert from "node:assert/strict";
import { parseReagentInput } from "@/lib/reagent-ingest/parse-reagent";

function createFakeClient(outputs: string[]) {
  return {
    responses: {
      create: async () => {
        const next = outputs.shift();
        if (next === undefined) {
          throw new Error("NO_MORE_FAKE_OUTPUTS");
        }
        return { output_text: next, output: [] };
      },
    },
  } as const;
}

async function withEnv<T>(env: Record<string, string | undefined>, run: () => Promise<T>) {
  const previous = Object.fromEntries(Object.keys(env).map((key) => [key, process.env[key]]));
  Object.entries(env).forEach(([key, value]) => {
    if (value === undefined) {
      delete process.env[key];
      return;
    }
    process.env[key] = value;
  });
  try {
    return await run();
  } finally {
    Object.entries(previous).forEach(([key, value]) => {
      if (value === undefined) {
        delete process.env[key];
        return;
      }
      process.env[key] = value;
    });
  }
}

test("parseReagentInput recovers invalid first-pass output with external verification", async () => {
  await withEnv(
    {
      OPENAI_BASE_URL: "https://api.minimaxi.com/v1",
      OPENAI_MODEL: "MiniMax-M1-80k",
    },
    async () => {
      const client = createFakeClient([
        "not-json",
        JSON.stringify({
          category: "BIOLOGICAL",
          subCategory: "Recombinant Protein",
          vendor: "Abcam",
          confidence: 0.93,
          warnings: [],
          experimentTags: ["CELL_STIMULATION_REAGENT"],
          antibodyMeta: null,
          primerMeta: null,
          verification: {
            status: "verified",
            method: "external_search",
            reason: "verified",
            warnings: [],
          },
        }),
      ]);

      const result = await parseReagentInput(
        {
          name: "Recombinant human BMP2 protein",
          catalogNo: "ab12345",
          note: "bone remodeling",
          lang: "zh",
        },
        {
          client: client as never,
          searchWeb: async () => [{ title: "Abcam BMP2 protein ab12345", url: "https://www.abcam.com/ab12345", snippet: "Abcam product page", domain: "www.abcam.com" }],
          fetchPages: async () => [
            {
              title: "Abcam BMP2 protein ab12345",
              url: "https://www.abcam.com/ab12345",
              domain: "www.abcam.com",
              snippet: "Abcam product page",
              excerpt: "Recombinant human BMP2 protein catalog ab12345 from Abcam.",
            },
          ],
        },
      );

      assert.equal(result.parseSource, "llm");
      assert.equal(result.verificationStatus, "verified");
      assert.equal(result.verificationMethod, "external_search");
      assert.equal(result.verificationReason, "verified");
      assert.equal(result.parsed.vendor, "Abcam");
      assert.equal(result.parsed.verification.status, "verified");
    },
  );
});

test("parseReagentInput keeps initial draft when verification fails", async () => {
  await withEnv(
    {
      OPENAI_BASE_URL: "https://api.minimaxi.com/v1",
      OPENAI_MODEL: "MiniMax-M1-80k",
    },
    async () => {
      const client = createFakeClient([
        JSON.stringify({
          category: "BUFFER",
          subCategory: "Lysis Buffer",
          vendor: "Beyotime",
          confidence: 0.88,
          warnings: [],
          experimentTags: ["WB_LYSIS_BUFFER"],
          antibodyMeta: null,
          primerMeta: null,
        }),
        "still-not-json",
      ]);

      const result = await parseReagentInput(
        {
          name: "RIPA Lysis Buffer",
          catalogNo: "P0013B",
          lang: "zh",
        },
        {
          client: client as never,
          searchWeb: async () => [],
          fetchPages: async () => [],
        },
      );

      assert.equal(result.parseSource, "llm");
      assert.equal(result.verificationStatus, "unverified");
      assert.equal(result.parsed.category, "BUFFER");
      assert.equal(result.parsed.verification.method, "none");
      assert.equal(result.verificationReason, "verification_model_failed");
    },
  );
});

test("parseReagentInput falls back only after llm and verification paths fail", async () => {
  await withEnv(
    {
      OPENAI_BASE_URL: "https://api.minimaxi.com/v1",
      OPENAI_MODEL: "MiniMax-M1-80k",
    },
    async () => {
      const client = createFakeClient(["bad-json", "bad-json-again"]);

      const result = await parseReagentInput(
        {
          name: "Puromycin",
          catalogNo: "bad",
          lang: "zh",
        },
        {
          client: client as never,
          searchWeb: async () => [],
          fetchPages: async () => [],
        },
      );

      assert.equal(result.parseSource, "fallback");
      assert.equal(result.verificationStatus, "unverified");
      assert.equal(result.verificationMethod, "none");
      assert.equal(result.verificationReason, "fallback_used");
      assert.ok(result.parsed.warnings.some((warning) => warning.includes("兜底")));
    },
  );
});
