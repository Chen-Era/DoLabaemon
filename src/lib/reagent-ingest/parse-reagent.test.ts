import test from "node:test";
import assert from "node:assert/strict";
import { parseReagentInput } from "@/lib/reagent-ingest/parse-reagent";

function createFakeClient(outputs: string[]) {
  const nextOutput = async () => {
    const next = outputs.shift();
    if (next === undefined) {
      throw new Error("NO_MORE_FAKE_OUTPUTS");
    }
    return next;
  };
  return {
    responses: {
      create: async () => {
        const next = await nextOutput();
        return { output_text: next, output: [] };
      },
    },
    chat: {
      completions: {
        create: async () => {
          const next = await nextOutput();
          return {
            choices: [
              {
                message: {
                  content: next,
                },
              },
            ],
          };
        },
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
      assert.equal(result.diagnostics?.path, "external_verified");
      assert.ok(typeof result.diagnostics?.timingsMs.externalVerify === "number");
    },
  );
});

test("parseReagentInput keeps initial draft when no external evidence is available", async () => {
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
      assert.equal(result.verificationReason, "external_search_no_results");
      assert.equal(result.diagnostics?.path, "initial_draft_only");
      assert.ok(result.diagnostics?.degradedStages.includes("external_search_no_results"));
    },
  );
});

test("parseReagentInput skips second llm call when no external evidence is available", async () => {
  await withEnv(
    {
      OPENAI_BASE_URL: "https://api.minimaxi.com/v1",
      OPENAI_MODEL: "MiniMax-M1-80k",
    },
    async () => {
      const client = createFakeClient([
        JSON.stringify({
          category: "BUFFER",
          subCategory: "Culture Medium",
          vendor: "Gibco",
          confidence: 0.91,
          warnings: [],
          experimentTags: ["CELL_CULTURE_MEDIUM"],
          antibodyMeta: null,
          primerMeta: null,
        }),
      ]);

      const result = await parseReagentInput(
        {
          name: "DMEM",
          catalogNo: "11965092",
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
      assert.equal(result.verificationMethod, "none");
      assert.equal(result.verificationReason, "external_search_no_results");
      assert.equal(result.parsed.category, "BUFFER");
      assert.equal(result.diagnostics?.path, "initial_draft_only");
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
      assert.equal(result.diagnostics?.path, "fallback");
      assert.ok(result.diagnostics?.degradedStages.includes("fallback_used"));
    },
  );
});

test("parseReagentInput falls back directly when initial draft is unavailable and no external evidence exists", async () => {
  await withEnv(
    {
      OPENAI_BASE_URL: "https://api.minimaxi.com/v1",
      OPENAI_MODEL: "MiniMax-M1-80k",
    },
    async () => {
      const client = createFakeClient(["bad-json"]);

      const result = await parseReagentInput(
        {
          name: "Puromycin",
          catalogNo: "P8833",
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
      assert.equal(result.diagnostics?.path, "fallback");
      assert.ok(result.diagnostics?.degradedStages.includes("external_search_no_results"));
      assert.ok(result.diagnostics?.degradedStages.includes("fallback_used"));
      assert.equal(result.diagnostics?.timingsMs.externalVerify, undefined);
    },
  );
});

test("parseReagentInput records external verify timing when verification model fails after evidence retrieval", async () => {
  await withEnv(
    {
      OPENAI_BASE_URL: "https://api.minimaxi.com/v1",
      OPENAI_MODEL: "MiniMax-M1-80k",
    },
    async () => {
      const client = createFakeClient([
        JSON.stringify({
          category: "BIOLOGICAL",
          subCategory: "Recombinant Protein",
          vendor: "Abcam",
          confidence: 0.9,
          warnings: [],
          experimentTags: ["CELL_STIMULATION_REAGENT"],
          antibodyMeta: null,
          primerMeta: null,
        }),
        "bad-json-again",
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
      assert.equal(result.verificationStatus, "unverified");
      assert.equal(result.verificationReason, "verification_model_failed");
      assert.equal(result.diagnostics?.path, "initial_draft_only");
      assert.ok(typeof result.diagnostics?.timingsMs.externalVerify === "number");
      assert.ok((result.diagnostics?.timingsMs.externalVerify ?? 0) >= 0);
      assert.ok(result.diagnostics?.degradedStages.includes("external_verify_failed"));
    },
  );
});

test("parseReagentInput records initial draft timing when first-pass model output fails", async () => {
  await withEnv(
    {
      OPENAI_BASE_URL: "https://api.minimaxi.com/v1",
      OPENAI_MODEL: "MiniMax-M1-80k",
    },
    async () => {
      const client = createFakeClient(["bad-json"]);

      const result = await parseReagentInput(
        {
          name: "Puromycin",
          catalogNo: "P8833",
          lang: "zh",
        },
        {
          client: client as never,
          searchWeb: async () => [],
          fetchPages: async () => [],
        },
      );

      assert.equal(result.parseSource, "fallback");
      assert.ok(typeof result.diagnostics?.timingsMs.initialDraft === "number");
      assert.ok((result.diagnostics?.timingsMs.initialDraft ?? 0) >= 0);
      assert.ok(result.diagnostics?.degradedStages.includes("initial_draft_failed"));
    },
  );
});

test("parseReagentInput parses think-wrapped fenced model output instead of falling back", async () => {
  await withEnv(
    {
      OPENAI_BASE_URL: "https://api.minimaxi.com/v1",
      OPENAI_MODEL: "MiniMax-M1-80k",
    },
    async () => {
      const draftJson = JSON.stringify({
        category: "BUFFER",
        subCategory: "Culture Medium",
        vendor: "Gibco",
        confidence: 0.9,
        warnings: [],
        experimentTags: ["CELL_CULTURE_MEDIUM"],
        antibodyMeta: null,
        primerMeta: null,
      });
      const client = createFakeClient([
        `<think>DMEM 是常用细胞培养基，应归为 BUFFER，标签 CELL_CULTURE_MEDIUM。</think>\n\`\`\`json\n${draftJson}\n\`\`\``,
      ]);

      const result = await parseReagentInput(
        {
          name: "DMEM",
          catalogNo: "11965092",
          lang: "zh",
        },
        {
          client: client as never,
          searchWeb: async () => [],
          fetchPages: async () => [],
        },
      );

      assert.equal(result.parseSource, "llm");
      assert.equal(result.parsed.category, "BUFFER");
      assert.equal(result.parsed.vendor, "Gibco");
      assert.deepEqual(result.parsed.experimentTags, ["CELL_CULTURE_MEDIUM"]);
      assert.equal(result.diagnostics?.path, "initial_draft_only");
      assert.ok(!result.diagnostics?.degradedStages.includes("initial_draft_failed"));
    },
  );
});

test("parseReagentInput coerces 0-100 confidence instead of falling back", async () => {
  await withEnv(
    {
      OPENAI_BASE_URL: "https://api.minimaxi.com/v1",
      OPENAI_MODEL: "MiniMax-M1-80k",
    },
    async () => {
      const client = createFakeClient([
        JSON.stringify({
          category: "BIOLOGICAL",
          subCategory: "Recombinant Protein",
          vendor: "R&D Systems",
          confidence: 92,
          warnings: [],
          experimentTags: ["CELL_STIMULATION_REAGENT"],
          antibodyMeta: null,
          primerMeta: null,
        }),
      ]);

      const result = await parseReagentInput(
        {
          name: "Recombinant Human RANKL Protein",
          catalogNo: "390-TN-010",
          lang: "zh",
        },
        {
          client: client as never,
          searchWeb: async () => [],
          fetchPages: async () => [],
        },
      );

      assert.equal(result.parseSource, "llm");
      assert.equal(result.parsed.category, "BIOLOGICAL");
      assert.equal(result.parsed.confidence, 0.92);
      assert.ok(result.parsed.warnings.some((warning) => warning.includes("0-100")));
      assert.ok(!result.diagnostics?.degradedStages.includes("initial_draft_failed"));
    },
  );
});

test("parseReagentInput coerces lowercase antibody roles and drops invented tags", async () => {
  await withEnv(
    {
      OPENAI_BASE_URL: "https://api.minimaxi.com/v1",
      OPENAI_MODEL: "MiniMax-M1-80k",
    },
    async () => {
      const client = createFakeClient([
        JSON.stringify({
          category: "ANTIBODY",
          subCategory: "Primary Antibody",
          vendor: "Abcam",
          confidence: 0.85,
          warnings: [],
          experimentTags: ["WB_PRIMARY_ANTIBODY", "NOT_A_REAL_TAG"],
          antibodyMeta: { role: "primary", hostSpecies: "Rabbit", targetSpecies: "Human", targetName: "CD9" },
          primerMeta: null,
        }),
      ]);

      const result = await parseReagentInput(
        {
          name: "Anti-CD9 antibody",
          catalogNo: "ab92726",
          lang: "zh",
        },
        {
          client: client as never,
          searchWeb: async () => [],
          fetchPages: async () => [],
        },
      );

      assert.equal(result.parseSource, "llm");
      assert.equal(result.parsed.category, "ANTIBODY");
      assert.equal(result.parsed.antibodyMeta?.role, "PRIMARY");
      assert.deepEqual(result.parsed.experimentTags, ["WB_PRIMARY_ANTIBODY"]);
      assert.ok(result.parsed.warnings.some((warning) => warning.includes("NOT_A_REAL_TAG")));
    },
  );
});

test("parseReagentInput supplements a tagless primary antibody after LLM parsing", async () => {
  await withEnv(
    {
      OPENAI_BASE_URL: "https://api.minimaxi.com/v1",
      OPENAI_MODEL: "MiniMax-M1-80k",
    },
    async () => {
      const client = createFakeClient([
        JSON.stringify({
          category: "ANTIBODY",
          subCategory: "Primary Antibody",
          vendor: "Abcam",
          confidence: 0.9,
          warnings: [],
          experimentTags: [],
          antibodyMeta: { role: "PRIMARY", hostSpecies: "Rabbit", targetSpecies: null, targetName: "SQSTM1" },
          primerMeta: null,
        }),
      ]);

      const result = await parseReagentInput(
        {
          name: "Anti-SQSTM1 / p62 antibody",
          catalogNo: "ab109012",
          lang: "zh",
        },
        {
          client: client as never,
          searchWeb: async () => [],
          fetchPages: async () => [],
        },
      );

      assert.equal(result.parsed.category, "ANTIBODY");
      assert.equal(result.parsed.antibodyMeta?.role, "PRIMARY");
      assert.ok(result.parsed.experimentTags.includes("WB_PRIMARY_ANTIBODY"));
    },
  );
});

test("parseReagentInput removes primary-antibody tags from an explicit secondary antibody", async () => {
  await withEnv(
    {
      OPENAI_BASE_URL: "https://api.minimaxi.com/v1",
      OPENAI_MODEL: "MiniMax-M1-80k",
    },
    async () => {
      const client = createFakeClient([
        JSON.stringify({
          category: "ANTIBODY",
          subCategory: "Secondary Antibody",
          vendor: "Jackson ImmunoResearch",
          confidence: 0.9,
          warnings: [],
          experimentTags: ["WB_PRIMARY_ANTIBODY"],
          antibodyMeta: { role: "PRIMARY", hostSpecies: "Goat", targetSpecies: "Rabbit", targetName: null },
          primerMeta: null,
        }),
      ]);

      const result = await parseReagentInput(
        {
          name: "Goat anti-rabbit IgG (H+L), HRP secondary antibody",
          catalogNo: "111-035-144",
          lang: "zh",
        },
        {
          client: client as never,
          searchWeb: async () => [],
          fetchPages: async () => [],
        },
      );

      assert.equal(result.parsed.antibodyMeta?.role, "SECONDARY");
      assert.ok(!result.parsed.experimentTags.includes("WB_PRIMARY_ANTIBODY"));
      assert.ok(result.parsed.experimentTags.includes("WB_SECONDARY_ANTIBODY"));
    },
  );
});

test("parseReagentInput salvages truncated model output instead of falling back", async () => {
  await withEnv(
    {
      OPENAI_BASE_URL: "https://api.minimaxi.com/v1",
      OPENAI_MODEL: "MiniMax-M1-80k",
    },
    async () => {
      const fullDraft = JSON.stringify({
        category: "BUFFER",
        subCategory: "Culture Medium",
        vendor: "Gibco",
        confidence: 0.9,
        warnings: [],
        experimentTags: ["CELL_CULTURE_MEDIUM"],
        antibodyMeta: null,
        primerMeta: null,
      });
      const client = createFakeClient([fullDraft.slice(0, Math.floor(fullDraft.length * 0.6))]);

      const result = await parseReagentInput(
        {
          name: "DMEM",
          catalogNo: "11965092",
          lang: "zh",
        },
        {
          client: client as never,
          searchWeb: async () => [],
          fetchPages: async () => [],
        },
      );

      assert.equal(result.parseSource, "llm");
      assert.equal(result.parsed.category, "BUFFER");
      assert.equal(result.parsed.vendor, "Gibco");
    },
  );
});

test("parseReagentInput recovers when the provider rejects temperature=0", async () => {
  await withEnv(
    {
      OPENAI_BASE_URL: "https://mimo.example.com/v1",
      OPENAI_MODEL: "mimo-v1",
    },
    async () => {
      let attempts = 0;
      const client = {
        chat: {
          completions: {
            create: async (body: Record<string, unknown>) => {
              attempts += 1;
              if ("temperature" in body) {
                throw new Error("400 temperature must be in (0, 1]");
              }
              return {
                choices: [
                  {
                    message: {
                      content: JSON.stringify({
                        category: "BUFFER",
                        subCategory: "Culture Medium",
                        vendor: "Gibco",
                        confidence: 0.9,
                        warnings: [],
                        experimentTags: ["CELL_CULTURE_MEDIUM"],
                        antibodyMeta: null,
                        primerMeta: null,
                      }),
                    },
                  },
                ],
              };
            },
          },
        },
      };

      const result = await parseReagentInput(
        {
          name: "DMEM",
          catalogNo: "11965092",
          lang: "zh",
        },
        {
          client: client as never,
          searchWeb: async () => [],
          fetchPages: async () => [],
        },
      );

      assert.equal(result.parseSource, "llm");
      assert.equal(attempts, 2);
      assert.equal(result.parsed.category, "BUFFER");
    },
  );
});

test("parseReagentInput skips web verification on high-confidence knowledge hit", async () => {
  await withEnv(
    {
      OPENAI_BASE_URL: "https://api.minimaxi.com/v1",
      OPENAI_MODEL: "MiniMax-M1-80k",
      LLM_KNOWLEDGE_VERIFY_THRESHOLD: undefined,
    },
    async () => {
      const client = createFakeClient([
        JSON.stringify({
          category: "BIOLOGICAL",
          subCategory: "Recombinant Protein",
          vendor: "R&D Systems",
          confidence: 0.95,
          warnings: [],
          experimentTags: ["CELL_STIMULATION_REAGENT"],
          antibodyMeta: null,
          primerMeta: null,
        }),
      ]);
      let searchCalls = 0;

      const result = await parseReagentInput(
        {
          name: "RANKL",
          catalogNo: "",
          lang: "zh",
        },
        {
          client: client as never,
          searchWeb: async () => {
            searchCalls += 1;
            return [];
          },
          fetchPages: async () => {
            searchCalls += 1;
            return [];
          },
        },
      );

      assert.equal(result.parseSource, "llm");
      assert.equal(result.verificationStatus, "verified");
      assert.equal(result.verificationMethod, "knowledge_base");
      assert.equal(result.verificationReason, "knowledge_base_hit");
      assert.equal(result.parsed.vendor, "R&D Systems");
      assert.equal(result.diagnostics?.path, "knowledge_verified");
      assert.equal(searchCalls, 0);
      assert.deepEqual(result.diagnostics?.degradedStages, []);
      assert.ok(result.parsed.verification.warnings.some((warning) => warning.includes("已跳过联网验证")));
    },
  );
});

test("parseReagentInput keeps web verification when knowledge skip is disabled", async () => {
  await withEnv(
    {
      OPENAI_BASE_URL: "https://api.minimaxi.com/v1",
      OPENAI_MODEL: "MiniMax-M1-80k",
    },
    async () => {
      const client = createFakeClient([
        JSON.stringify({
          category: "BIOLOGICAL",
          subCategory: "Recombinant Protein",
          vendor: "R&D Systems",
          confidence: 0.9,
          warnings: [],
          experimentTags: ["CELL_STIMULATION_REAGENT"],
          antibodyMeta: null,
          primerMeta: null,
        }),
        JSON.stringify({
          category: "BIOLOGICAL",
          subCategory: "Recombinant Protein",
          vendor: "R&D Systems",
          confidence: 0.95,
          warnings: [],
          experimentTags: ["CELL_STIMULATION_REAGENT", "OSTEOCLAST_DIFFERENTIATION_REAGENT"],
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
          name: "RANKL",
          catalogNo: "",
          lang: "zh",
        },
        {
          client: client as never,
          llmConfig: {
            model: "MiniMax-M1-80k",
            visionModel: "MiniMax-VL-01",
            searchEnabled: true,
            enabledSkills: [],
            enabledMcpServers: [],
            selfCheckEnabled: false,
            autoLearnEnabled: false,
            reasoningEffort: "off",
            knowledgeVerifySkipEnabled: false,
          },
          searchWeb: async () => [{ title: "R&D RANKL 390-TN", url: "https://www.rndsystems.com/390-tn", snippet: "product page", domain: "www.rndsystems.com" }],
          fetchPages: async () => [
            {
              title: "R&D RANKL 390-TN",
              url: "https://www.rndsystems.com/390-tn",
              domain: "www.rndsystems.com",
              snippet: "product page",
              excerpt: "Recombinant human RANKL protein from R&D Systems.",
            },
          ],
        },
      );

      assert.equal(result.verificationStatus, "verified");
      assert.equal(result.verificationMethod, "external_search");
      assert.equal(result.verificationReason, "verified");
      assert.equal(result.diagnostics?.path, "external_verified");
    },
  );
});

test("parseReagentInput does not skip when threshold is raised above the knowledge confidence", async () => {
  await withEnv(
    {
      OPENAI_BASE_URL: "https://api.minimaxi.com/v1",
      OPENAI_MODEL: "MiniMax-M1-80k",
      LLM_KNOWLEDGE_VERIFY_THRESHOLD: "1.5",
    },
    async () => {
      const client = createFakeClient([
        JSON.stringify({
          category: "BIOLOGICAL",
          subCategory: "Recombinant Protein",
          vendor: "R&D Systems",
          confidence: 0.9,
          warnings: [],
          experimentTags: ["CELL_STIMULATION_REAGENT"],
          antibodyMeta: null,
          primerMeta: null,
        }),
      ]);
      let searchCalls = 0;

      const result = await parseReagentInput(
        {
          name: "RANKL",
          catalogNo: "",
          lang: "zh",
        },
        {
          client: client as never,
          searchWeb: async () => {
            searchCalls += 1;
            return [];
          },
          fetchPages: async () => [],
        },
      );

      assert.equal(searchCalls, 1);
      assert.equal(result.verificationStatus, "unverified");
      assert.equal(result.verificationMethod, "none");
      assert.equal(result.verificationReason, "external_search_no_results");
      assert.equal(result.diagnostics?.path, "initial_draft_only");
    },
  );
});
