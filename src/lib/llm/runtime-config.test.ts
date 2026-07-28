import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cleanUrlText } from "@/lib/url/clean-url";

// Runtime-config reads/writes go through the demo store in tests. Give this
// file its own store path BEFORE demo-store is imported (it reads the env var
// at module load): the shared default path races with other test files that
// rewrite the whole store concurrently.
process.env.DEMO_MODE = "true";
process.env.LAB_LLM_CONFIG_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
const testStoreDir = mkdtempSync(join(tmpdir(), "lab-reagent-runtime-config-"));
process.env.LAB_REAGENT_DEMO_STORE_PATH = join(testStoreDir, "demo-store.json");
test.after(() => rmSync(testStoreDir, { recursive: true, force: true }));

let getLlmConfigView: (typeof import("@/lib/llm/runtime-config"))["getLlmConfigView"];
let getRuntimeLlmConfigForUser: (typeof import("@/lib/llm/runtime-config"))["getRuntimeLlmConfigForUser"];
let getRuntimeLlmConfigForLabMember: (typeof import("@/lib/llm/runtime-config"))["getRuntimeLlmConfigForLabMember"];
let upsertUserLlmConfig: (typeof import("@/lib/llm/runtime-config"))["upsertUserLlmConfig"];
let getLabLlmConfigView: (typeof import("@/lib/llm/lab-config"))["getLabLlmConfigView"];
let upsertLabLlmConfig: (typeof import("@/lib/llm/lab-config"))["upsertLabLlmConfig"];
let demoUpsertLlmConfig: (typeof import("@/lib/demo-store"))["demoUpsertLlmConfig"];
let demoCreateLab: (typeof import("@/lib/demo-store"))["demoCreateLab"];
let demoRegister: (typeof import("@/lib/demo-store"))["demoRegister"];
test.before(async () => {
  ({ getLlmConfigView, getRuntimeLlmConfigForUser, getRuntimeLlmConfigForLabMember, upsertUserLlmConfig } = await import("@/lib/llm/runtime-config"));
  ({ getLabLlmConfigView, upsertLabLlmConfig } = await import("@/lib/llm/lab-config"));
  ({ demoUpsertLlmConfig, demoCreateLab, demoRegister } = await import("@/lib/demo-store"));
});

test("cleanUrlText trims whitespace and unwraps quoted urls", () => {
  assert.equal(cleanUrlText(" `https://api-inference.modelscope.cn/v1` "), "https://api-inference.modelscope.cn/v1");
  assert.equal(cleanUrlText(" 'https://example.com/api' "), "https://example.com/api");
  assert.equal(cleanUrlText(" \"https://example.com/v1\" "), "https://example.com/v1");
});

test("cleanUrlText keeps plain urls and empties blank input", () => {
  assert.equal(cleanUrlText("https://example.com/v1"), "https://example.com/v1");
  assert.equal(cleanUrlText("   "), null);
  assert.equal(cleanUrlText(undefined), null);
});

function freshUserId() {
  return `user-${Math.random().toString(36).slice(2, 10)}`;
}

function clearToggleEnv() {
  delete process.env.LLM_REASONING_EFFORT;
  delete process.env.LLM_THINKING_ENABLED;
  delete process.env.LLM_KNOWLEDGE_VERIFY_SKIP_ENABLED;
}

test("runtime config defaults reasoning effort off and knowledge verify skip on", async () => {
  clearToggleEnv();
  const runtime = await getRuntimeLlmConfigForUser(freshUserId());
  assert.equal(runtime.reasoningEffort, "off");
  assert.equal(runtime.knowledgeVerifySkipEnabled, true);
});

test("runtime config reads the reasoning effort from env when nothing is saved", async () => {
  process.env.LLM_REASONING_EFFORT = "high";
  process.env.LLM_KNOWLEDGE_VERIFY_SKIP_ENABLED = "false";
  try {
    const runtime = await getRuntimeLlmConfigForUser(freshUserId());
    assert.equal(runtime.reasoningEffort, "high");
    assert.equal(runtime.knowledgeVerifySkipEnabled, false);
  } finally {
    clearToggleEnv();
  }
});

test("runtime config treats the legacy LLM_THINKING_ENABLED switch as medium/off", async () => {
  process.env.LLM_THINKING_ENABLED = "true";
  process.env.LLM_KNOWLEDGE_VERIFY_SKIP_ENABLED = "false";
  try {
    const runtime = await getRuntimeLlmConfigForUser(freshUserId());
    assert.equal(runtime.reasoningEffort, "medium");
    assert.equal(runtime.knowledgeVerifySkipEnabled, false);
  } finally {
    clearToggleEnv();
  }
});

test("legacy env switch loses to LLM_REASONING_EFFORT when both are set", async () => {
  process.env.LLM_REASONING_EFFORT = "low";
  process.env.LLM_THINKING_ENABLED = "true";
  try {
    const runtime = await getRuntimeLlmConfigForUser(freshUserId());
    assert.equal(runtime.reasoningEffort, "low");
  } finally {
    clearToggleEnv();
  }
});

test("runtime config upgrades legacy demo thinking switches without losing the choice", async () => {
  clearToggleEnv();
  const userId = freshUserId();
  demoUpsertLlmConfig(userId, { thinkingEnabled: true });

  let runtime = await getRuntimeLlmConfigForUser(userId);
  assert.equal(runtime.reasoningEffort, "medium");

  // A later partial save writes the normalized field rather than resetting it.
  await upsertUserLlmConfig(userId, { openaiModel: "test-model" });
  runtime = await getRuntimeLlmConfigForUser(userId);
  assert.equal(runtime.reasoningEffort, "medium");
});

test("upsert persists the reasoning effort and keeps it across unrelated updates", async () => {
  clearToggleEnv();
  const userId = freshUserId();
  await upsertUserLlmConfig(userId, { reasoningEffort: "high", knowledgeVerifySkipEnabled: false });
  let runtime = await getRuntimeLlmConfigForUser(userId);
  assert.equal(runtime.reasoningEffort, "high");
  assert.equal(runtime.knowledgeVerifySkipEnabled, false);

  // ?? current fallback: an unrelated partial update must not reset the saved level.
  await upsertUserLlmConfig(userId, { openaiModel: "test-model" });
  runtime = await getRuntimeLlmConfigForUser(userId);
  assert.equal(runtime.reasoningEffort, "high");
  assert.equal(runtime.knowledgeVerifySkipEnabled, false);

  // A saved value wins over the env default.
  process.env.LLM_REASONING_EFFORT = "low";
  try {
    runtime = await getRuntimeLlmConfigForUser(userId);
    assert.equal(runtime.reasoningEffort, "high");
  } finally {
    clearToggleEnv();
  }

  // Explicit off is honored too.
  await upsertUserLlmConfig(userId, { reasoningEffort: "off" });
  runtime = await getRuntimeLlmConfigForUser(userId);
  assert.equal(runtime.reasoningEffort, "off");
});

test("llm config view exposes the reasoning effort", async () => {
  clearToggleEnv();
  const userId = freshUserId();
  const initial = await getLlmConfigView(userId);
  assert.equal(initial.saved.reasoningEffort, null);
  assert.equal(initial.saved.knowledgeVerifySkipEnabled, null);
  assert.equal(initial.runtime.reasoningEffort, "off");
  assert.equal(initial.runtime.knowledgeVerifySkipEnabled, true);

  await upsertUserLlmConfig(userId, { reasoningEffort: "medium", knowledgeVerifySkipEnabled: false });
  const view = await getLlmConfigView(userId);
  assert.equal(view.saved.reasoningEffort, "medium");
  assert.equal(view.saved.knowledgeVerifySkipEnabled, false);
  assert.equal(view.runtime.reasoningEffort, "medium");
  assert.equal(view.runtime.knowledgeVerifySkipEnabled, false);
});

test("enabledSkills defaults to all built-in skills when LLM_ENABLED_SKILLS is unset", async () => {
  const savedValue = process.env.LLM_ENABLED_SKILLS;
  delete process.env.LLM_ENABLED_SKILLS;
  try {
    const runtime = await getRuntimeLlmConfigForUser(freshUserId());
    assert.deepEqual(runtime.enabledSkills, [
      "reagent-classification-curator",
      "experiment-type-curator",
      "reagent-parse-output",
    ]);
  } finally {
    if (savedValue === undefined) {
      delete process.env.LLM_ENABLED_SKILLS;
    } else {
      process.env.LLM_ENABLED_SKILLS = savedValue;
    }
  }
});

test("enabledSkills follows LLM_ENABLED_SKILLS once set, even to an empty list", async () => {
  process.env.LLM_ENABLED_SKILLS = "";
  try {
    const runtime = await getRuntimeLlmConfigForUser(freshUserId());
    assert.deepEqual(runtime.enabledSkills, []);
  } finally {
    delete process.env.LLM_ENABLED_SKILLS;
  }
});

test("an enabled lab model atomically overrides a member's personal model", async () => {
  await upsertUserLlmConfig("demo-user", {
    openaiApiKey: "personal-secret",
    openaiBaseUrl: "https://personal.example/v1",
    openaiModel: "personal-model",
    openaiVisionModel: "personal-vision",
    reasoningEffort: "low",
  });
  await upsertLabLlmConfig("demo-lab", {
    openaiApiKey: "lab-secret",
    openaiBaseUrl: "https://lab.example/v1",
    openaiModel: "lab-model",
    openaiVisionModel: "lab-vision",
    reasoningEffort: "high",
  });

  const runtime = await getRuntimeLlmConfigForLabMember("demo-user", "demo-lab");
  assert.equal(runtime.source, "lab");
  assert.equal(runtime.apiKey, "lab-secret");
  assert.equal(runtime.baseURL, "https://lab.example/v1");
  assert.equal(runtime.model, "lab-model");
  assert.equal(runtime.visionModel, "lab-vision");
  assert.equal(runtime.reasoningEffort, "high");
});

test("shared model configs are isolated by lab and expose no API key in their view", async () => {
  const created = demoCreateLab({ userId: "demo-user", name: "第二实验室" });
  assert.ok(!("error" in created));
  await upsertLabLlmConfig(created.labId, {
    openaiApiKey: "second-lab-secret",
    openaiModel: "second-lab-model",
  });

  const first = await getRuntimeLlmConfigForLabMember("demo-user", "demo-lab");
  const second = await getRuntimeLlmConfigForLabMember("demo-user", created.labId);
  assert.equal(first.model, "lab-model");
  assert.equal(second.model, "second-lab-model");
  assert.equal(second.apiKey, "second-lab-secret");

  const view = await getLabLlmConfigView(created.labId);
  assert.equal(view.hasOpenaiApiKey, true);
  assert.equal(JSON.stringify(view).includes("second-lab-secret"), false);
});

test("a partial shared-model update preserves its encrypted key and endpoint", async () => {
  const created = demoCreateLab({ userId: "demo-user", name: "部分更新实验室" });
  assert.ok(!("error" in created));
  await upsertLabLlmConfig(created.labId, {
    openaiApiKey: "preserved-secret",
    openaiBaseUrl: "https://preserved.example/v1",
    openaiModel: "first-model",
  });
  await upsertLabLlmConfig(created.labId, { openaiModel: "updated-model" });

  const runtime = await getRuntimeLlmConfigForLabMember("demo-user", created.labId);
  assert.equal(runtime.apiKey, "preserved-secret");
  assert.equal(runtime.baseURL, "https://preserved.example/v1");
  assert.equal(runtime.model, "updated-model");
});

test("a non-member cannot resolve another laboratory's shared model", async () => {
  const registered = await demoRegister({
    email: `outsider-${Math.random().toString(36).slice(2)}@example.com`,
    password: "secret123",
    mode: "none",
  });
  assert.ok(!("error" in registered));
  await assert.rejects(
    () => getRuntimeLlmConfigForLabMember(registered.userId, "demo-lab"),
    /NO_LAB_ACCESS/,
  );
});
