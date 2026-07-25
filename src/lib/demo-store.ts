import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { evaluateRules } from "@/lib/rules/evaluate";
import { ruleCatalog, type ExperimentTag } from "@/lib/rules/catalog";
import { checkWbAntibodyCompatibility } from "@/lib/rules/wb-antibody-check";
import { resolveExperimentInput } from "@/lib/experiment/resolve";
import type { ExperimentResolution } from "@/lib/experiment-knowledge/types";
import type { ExperimentKnowledgeEntry } from "@/lib/experiment-knowledge/types";
import type { UserLlmConfigInput } from "@/lib/llm/runtime-config";
import type { RuntimeLlmConfig } from "@/lib/llm/runtime-config";
import type { ReagentKnowledgeEntry } from "@/lib/reagent-knowledge/types";
import {
  buildHeuristicParse,
  type HeuristicParsedReagent,
  type ParsedAntibodyMeta,
  type ParsedPrimerMeta,
  type ReagentCategory,
} from "@/lib/reagent-tagging";
import reagentKnowledgeCatalog from "@/lib/reagent-knowledge/catalog.json";
import experimentKnowledgeCatalog from "@/lib/experiment-knowledge/catalog.json";

type Role = "PI" | "ADMIN" | "MEMBER";

type DemoUser = { id: string; email: string; displayName?: string; passwordHash: string };
type DemoLab = { id: string; name: string };
type DemoMembership = { userId: string; labId: string; role: Role };
type DemoAntibodyMeta = ParsedAntibodyMeta;
type DemoPrimerMeta = ParsedPrimerMeta;

type DemoParsedOutput = HeuristicParsedReagent;

type DemoReagent = {
  id: string;
  labId: string;
  name: string;
  catalogNo: string;
  category: ReagentCategory;
  subCategory?: string | null;
  vendor?: string | null;
  note?: string | null;
  quantity?: number | null;
  experimentTags: ExperimentTag[];
  antibodyMeta?: DemoAntibodyMeta | null;
  primerMeta?: DemoPrimerMeta | null;
  createdAt: string;
};

type DemoDraft = {
  id: string;
  labId: string;
  userId: string;
  parsedOutput: DemoParsedOutput;
  isConfirmed: boolean;
};

type DemoExperimentResolveDraft = {
  id: string;
  labId: string;
  userId: string;
  resolvedOutput: ExperimentResolution;
  isConfirmed: boolean;
};

type DemoLlmConfig = UserLlmConfigInput & {
  userId: string;
};

type DemoLabAiPolicy = {
  labId: string;
  allowAutoLearn: boolean;
  allowedRoles: Role[];
  enabledKnowledgeDomains: string[];
};

type DemoKnowledgeMutationLog = {
  id: string;
  labId: string;
  userId: string;
  flowType: string;
  domain: string;
  entityKey: string;
  status: string;
  beforeData?: unknown;
  afterData?: unknown;
  evidenceSummary: string[];
  modelName?: string | null;
  rolledBackAt?: string | null;
  createdAt: string;
};

type DemoReagentKnowledgeEntry = ReagentKnowledgeEntry & {
  source?: string;
};

type DemoExperimentKnowledgeEntry = ExperimentKnowledgeEntry & {
  source?: string;
};

type DemoStoreShape = {
  users: DemoUser[];
  labs: DemoLab[];
  memberships: DemoMembership[];
  invites: Array<{ id: string; labId: string; email: string; role: Role }>;
  reagents: DemoReagent[];
  drafts: DemoDraft[];
  experimentResolveDrafts: DemoExperimentResolveDraft[];
  llmConfigs: DemoLlmConfig[];
  aiPolicies: DemoLabAiPolicy[];
  knowledgeMutationLogs: DemoKnowledgeMutationLog[];
  reagentKnowledgeEntries: DemoReagentKnowledgeEntry[];
  experimentKnowledgeEntries: DemoExperimentKnowledgeEntry[];
};

const DEMO_DATA_DIR = path.join(process.cwd(), ".data");
const DEMO_STORE_PATH = path.join(DEMO_DATA_DIR, "demo-store.json");
const DEMO_DEFAULT_EMAIL = "demo@lab.local";
const DEMO_DEFAULT_PASSWORD = "demo123456";

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function parseCookie(cookieHeader?: string | null) {
  const pairs = (cookieHeader ?? "").split(/;\s*/).filter(Boolean);
  const entries = pairs.map((part) => {
    const idx = part.indexOf("=");
    if (idx < 0) return [part, ""];
    return [part.slice(0, idx), decodeURIComponent(part.slice(idx + 1))];
  });
  return Object.fromEntries(entries);
}

function createDefaultStore(): DemoStoreShape {
  const demoUserId = "demo-user";
  const demoLabId = "demo-lab";
  return {
    users: [
      {
        id: demoUserId,
        email: DEMO_DEFAULT_EMAIL,
        displayName: "Demo User",
        passwordHash: bcrypt.hashSync(DEMO_DEFAULT_PASSWORD, 12),
      },
    ],
    labs: [{ id: demoLabId, name: "Demo Lab" }],
    memberships: [{ userId: demoUserId, labId: demoLabId, role: "PI" }],
    invites: [],
    reagents: [],
    drafts: [],
    experimentResolveDrafts: [],
    llmConfigs: [],
    aiPolicies: [
      {
        labId: demoLabId,
        allowAutoLearn: false,
        allowedRoles: ["PI"],
        enabledKnowledgeDomains: ["REAGENT", "EXPERIMENT"],
      },
    ],
    knowledgeMutationLogs: [],
    reagentKnowledgeEntries: reagentKnowledgeCatalog as DemoReagentKnowledgeEntry[],
    experimentKnowledgeEntries: experimentKnowledgeCatalog as DemoExperimentKnowledgeEntry[],
  };
}

function ensureDemoStore() {
  fs.mkdirSync(DEMO_DATA_DIR, { recursive: true });
  if (!fs.existsSync(DEMO_STORE_PATH)) {
    fs.writeFileSync(DEMO_STORE_PATH, JSON.stringify(createDefaultStore(), null, 2));
  }
}

function readStore(): DemoStoreShape {
  ensureDemoStore();
  const raw = fs.readFileSync(DEMO_STORE_PATH, "utf8");
  const parsed = JSON.parse(raw) as Partial<DemoStoreShape>;
  const base = createDefaultStore();
  return {
    users: Array.isArray(parsed.users) ? parsed.users : base.users,
    labs: Array.isArray(parsed.labs) ? parsed.labs : base.labs,
    memberships: Array.isArray(parsed.memberships) ? parsed.memberships : base.memberships,
    invites: Array.isArray(parsed.invites) ? parsed.invites : [],
    reagents: Array.isArray(parsed.reagents) ? parsed.reagents : [],
    drafts: Array.isArray(parsed.drafts) ? parsed.drafts : [],
    experimentResolveDrafts: Array.isArray(parsed.experimentResolveDrafts) ? parsed.experimentResolveDrafts : [],
    llmConfigs: Array.isArray(parsed.llmConfigs) ? parsed.llmConfigs : [],
    aiPolicies: Array.isArray(parsed.aiPolicies) ? parsed.aiPolicies : base.aiPolicies,
    knowledgeMutationLogs: Array.isArray(parsed.knowledgeMutationLogs) ? parsed.knowledgeMutationLogs : [],
    reagentKnowledgeEntries: Array.isArray(parsed.reagentKnowledgeEntries) ? parsed.reagentKnowledgeEntries : base.reagentKnowledgeEntries,
    experimentKnowledgeEntries: Array.isArray(parsed.experimentKnowledgeEntries) ? parsed.experimentKnowledgeEntries : base.experimentKnowledgeEntries,
  };
}

function writeStore(store: DemoStoreShape) {
  ensureDemoStore();
  fs.writeFileSync(DEMO_STORE_PATH, JSON.stringify(store, null, 2));
}

function applicableRules(experimentCode: string, directionCode?: string) {
  return ruleCatalog.filter((rule) => {
    if (rule.experimentCode !== experimentCode) return false;
    if (!rule.directionCode) return true;
    return rule.directionCode === directionCode;
  });
}

export function demoDefaultCredentials() {
  return { email: DEMO_DEFAULT_EMAIL, password: DEMO_DEFAULT_PASSWORD };
}

export function demoRequireUser(req?: Request) {
  const store = readStore();
  const cookies = parseCookie(req?.headers.get("cookie"));
  const requestedUserId = typeof cookies.demo_user_id === "string" ? cookies.demo_user_id : undefined;
  const matchedUser = (requestedUserId ? store.users.find((user) => user.id === requestedUserId) : undefined) ?? store.users[0];

  return {
    id: matchedUser.id,
    email: matchedUser.email,
    name: matchedUser.displayName ?? matchedUser.email,
  };
}

export function demoGetLlmConfig(userId: string) {
  const store = readStore();
  return store.llmConfigs.find((item) => item.userId === userId) ?? null;
}

export function demoUpsertLlmConfig(userId: string, input: UserLlmConfigInput) {
  const store = readStore();
  const current = store.llmConfigs.find((item) => item.userId === userId);
  const next: DemoLlmConfig = { ...current, userId, ...input };
  const existingIndex = store.llmConfigs.findIndex((item) => item.userId === userId);
  if (existingIndex >= 0) {
    store.llmConfigs[existingIndex] = next;
  } else {
    store.llmConfigs.push(next);
  }
  writeStore(store);
  return next;
}

export function demoGetLabMembership(userId: string, labId: string) {
  const store = readStore();
  return store.memberships.find((item) => item.userId === userId && item.labId === labId) ?? null;
}

export function demoGetLabAiPolicy(labId: string) {
  const store = readStore();
  return (
    store.aiPolicies.find((item) => item.labId === labId) ?? {
      labId,
      allowAutoLearn: false,
      allowedRoles: ["PI"],
      enabledKnowledgeDomains: ["REAGENT", "EXPERIMENT"],
    }
  );
}

export function demoUpsertLabAiPolicy(input: DemoLabAiPolicy) {
  const store = readStore();
  const existingIndex = store.aiPolicies.findIndex((item) => item.labId === input.labId);
  if (existingIndex >= 0) {
    store.aiPolicies[existingIndex] = input;
  } else {
    store.aiPolicies.push(input);
  }
  writeStore(store);
  return input;
}

export function demoCreateKnowledgeMutationLog(
  input: Omit<DemoKnowledgeMutationLog, "id" | "createdAt" | "rolledBackAt"> & { rolledBackAt?: string | null },
) {
  const store = readStore();
  const next: DemoKnowledgeMutationLog = {
    id: uid("knowledge-log"),
    createdAt: new Date().toISOString(),
    rolledBackAt: input.rolledBackAt ?? null,
    ...input,
  };
  store.knowledgeMutationLogs.unshift(next);
  writeStore(store);
  return next;
}

export function demoListKnowledgeMutationLogs(labId: string) {
  const store = readStore();
  return store.knowledgeMutationLogs.filter((item) => item.labId === labId).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function demoGetKnowledgeMutationLog(logId: string) {
  const store = readStore();
  return store.knowledgeMutationLogs.find((item) => item.id === logId) ?? null;
}

export function demoRollbackKnowledgeMutationLog(logId: string) {
  const store = readStore();
  const matched = store.knowledgeMutationLogs.find((item) => item.id === logId);
  if (!matched) {
    return { error: "LOG_NOT_FOUND" as const };
  }
  matched.status = "ROLLED_BACK";
  matched.rolledBackAt = new Date().toISOString();
  writeStore(store);
  return matched;
}

export function demoListReagentKnowledgeEntries() {
  const store = readStore();
  return store.reagentKnowledgeEntries;
}

export function demoListExperimentKnowledgeEntries() {
  const store = readStore();
  return store.experimentKnowledgeEntries;
}

export function demoUpsertReagentKnowledgeEntry(entry: DemoReagentKnowledgeEntry) {
  const store = readStore();
  const index = store.reagentKnowledgeEntries.findIndex((item) => item.id === entry.id);
  if (index >= 0) {
    store.reagentKnowledgeEntries[index] = entry;
  } else {
    store.reagentKnowledgeEntries.push(entry);
  }
  writeStore(store);
  return entry;
}

export function demoUpsertExperimentKnowledgeEntry(entry: DemoExperimentKnowledgeEntry) {
  const store = readStore();
  const index = store.experimentKnowledgeEntries.findIndex((item) => item.id === entry.id);
  if (index >= 0) {
    store.experimentKnowledgeEntries[index] = entry;
  } else {
    store.experimentKnowledgeEntries.push(entry);
  }
  writeStore(store);
  return entry;
}

export function demoDeleteReagentKnowledgeEntry(id: string) {
  const store = readStore();
  store.reagentKnowledgeEntries = store.reagentKnowledgeEntries.filter((item) => item.id !== id);
  writeStore(store);
}

export function demoDeleteExperimentKnowledgeEntry(id: string) {
  const store = readStore();
  store.experimentKnowledgeEntries = store.experimentKnowledgeEntries.filter((item) => item.id !== id);
  writeStore(store);
}

export async function demoLogin(input: { email: string; password: string }) {
  const store = readStore();
  const email = normalizeEmail(input.email);
  const user = store.users.find((candidate) => candidate.email === email);
  if (!user) {
    return { error: "INVALID_CREDENTIALS" as const };
  }
  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    return { error: "INVALID_CREDENTIALS" as const };
  }
  return {
    id: user.id,
    email: user.email,
    name: user.displayName ?? user.email,
  };
}

export async function demoRegister(input: { email: string; password: string; displayName?: string; labName: string }) {
  const store = readStore();
  const email = normalizeEmail(input.email);
  const exists = store.users.find((x) => x.email === email);
  if (exists) {
    return { error: "Email already exists", code: "EMAIL_EXISTS" as const };
  }
  const userId = uid("user");
  const labId = uid("lab");
  const user: DemoUser = {
    id: userId,
    email,
    passwordHash: await bcrypt.hash(input.password, 12),
  };
  if (input.displayName) {
    user.displayName = input.displayName;
  }
  store.users.push(user);
  store.labs.push({ id: labId, name: input.labName });
  store.memberships.push({ userId, labId, role: "PI" });
  store.aiPolicies.push({
    labId,
    allowAutoLearn: false,
    allowedRoles: ["PI"],
    enabledKnowledgeDomains: ["REAGENT", "EXPERIMENT"],
  });
  writeStore(store);
  return { userId, labId };
}

export function demoLabsOf(userId: string) {
  const store = readStore();
  return store.memberships
    .filter((m) => m.userId === userId)
    .map((m) => ({ role: m.role, lab: store.labs.find((x) => x.id === m.labId)! }));
}

export function demoCreateInvite(input: { userId: string; labId: string; email: string; role: Role }) {
  const store = readStore();
  const me = store.memberships.find((m) => m.userId === input.userId && m.labId === input.labId);
  if (!me || (me.role !== "PI" && me.role !== "ADMIN")) {
    return { error: "Permission denied", code: "PERMISSION_DENIED" as const };
  }
  const inviteId = uid("invite");
  store.invites.push({ id: inviteId, labId: input.labId, email: normalizeEmail(input.email), role: input.role });
  writeStore(store);
  return { inviteId };
}

export function demoCreateLab(input: { userId: string; name: string }) {
  const store = readStore();
  const labName = input.name.trim();
  if (!labName) {
    return { error: "实验室名称不能为空", code: "INVALID_LAB_NAME" as const };
  }
  const labId = uid("lab");
  store.labs.push({ id: labId, name: labName });
  store.memberships.push({ userId: input.userId, labId, role: "PI" });
  store.aiPolicies.push({
    labId,
    allowAutoLearn: false,
    allowedRoles: ["PI"],
    enabledKnowledgeDomains: ["REAGENT", "EXPERIMENT"],
  });
  writeStore(store);
  return { labId };
}

export function demoJoinLab(input: { userId: string; email?: string; inviteId: string }) {
  const store = readStore();
  const invite = store.invites.find((item) => item.id === input.inviteId.trim());
  if (!invite) {
    return { error: "邀请不存在", code: "INVITE_NOT_FOUND" as const };
  }
  if (input.email && normalizeEmail(input.email) !== invite.email) {
    return { error: "该邀请不属于当前账号", code: "INVITE_EMAIL_MISMATCH" as const };
  }
  const alreadyMember = store.memberships.find((item) => item.userId === input.userId && item.labId === invite.labId);
  if (alreadyMember) {
    return { error: "你已加入该实验室", code: "ALREADY_IN_LAB" as const };
  }
  store.memberships.push({ userId: input.userId, labId: invite.labId, role: invite.role });
  store.invites = store.invites.filter((item) => item.id !== invite.id);
  writeStore(store);
  return { labId: invite.labId };
}

export function demoListReagents(labId: string) {
  const store = readStore();
  return store.reagents.filter((x) => x.labId === labId).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function demoParseReagent(input: { labId: string; userId: string; name: string; catalogNo?: string; note?: string }) {
  const store = readStore();
  const parsed = buildHeuristicParse(input, "DEMO_MODE: parsed by local heuristic");
  const draftId = uid("draft");
  store.drafts.push({ id: draftId, labId: input.labId, userId: input.userId, parsedOutput: parsed, isConfirmed: false });
  writeStore(store);
  return { draftId, parsed };
}

export function demoConfirmReagent(input: {
  draftId: string;
  editedPayload: {
    labId: string;
    name: string;
    catalogNo: string;
    category: ReagentCategory;
    subCategory?: string | null;
    vendor?: string | null;
    note?: string | null;
    experimentTags?: ExperimentTag[];
    antibodyMeta?: DemoAntibodyMeta | null;
    primerMeta?: DemoPrimerMeta | null;
  };
}) {
  const store = readStore();
  const draft = store.drafts.find((d) => d.id === input.draftId);
  if (!draft || draft.isConfirmed) {
    return { error: "Invalid draft", code: "INVALID_DRAFT" as const };
  }
  const existing = store.reagents.find(
    (reagent) => reagent.labId === input.editedPayload.labId && reagent.catalogNo === input.editedPayload.catalogNo,
  );
  draft.isConfirmed = true;

  if (existing) {
    const beforeQuantity = existing.quantity ?? 1;
    existing.quantity = beforeQuantity + 1;
    writeStore(store);
    return {
      action: "incremented" as const,
      reagentId: existing.id,
      beforeQuantity,
      afterQuantity: existing.quantity,
    };
  }

  const reagentId = uid("reagent");
  store.reagents.push({
    id: reagentId,
    labId: input.editedPayload.labId,
    name: input.editedPayload.name,
    catalogNo: input.editedPayload.catalogNo,
    category: input.editedPayload.category,
    subCategory: input.editedPayload.subCategory,
    vendor: input.editedPayload.vendor,
    note: input.editedPayload.note,
    quantity: 1,
    experimentTags: input.editedPayload.experimentTags ?? draft.parsedOutput.experimentTags,
    antibodyMeta: input.editedPayload.antibodyMeta ?? draft.parsedOutput.antibodyMeta,
    primerMeta: input.editedPayload.primerMeta ?? draft.parsedOutput.primerMeta,
    createdAt: new Date().toISOString(),
  });
  writeStore(store);
  return { action: "created" as const, reagentId };
}

export function demoCheckExperiment(input: {
  labId: string;
  experimentType?: string;
  direction?: string;
  prerequisite?: string;
  resolution?: ExperimentResolution | null;
}) {
  if (!input.experimentType) {
    return {
      runId: uid("run"),
      status: "BLOCKED",
      confidenceLabel: "LOW",
      minMissing: [],
      recommendedMissing: [],
      warnings: ["手动输入的实验名称暂未能归一为正式实验类型，请先查看候选建议并确认。"],
      compatibilityIssues: [],
      resolvedExperimentType: input.resolution?.resolvedExperimentType ?? null,
      resolutionSource: input.resolution?.resolutionSource ?? "MODEL_SUGGESTION",
      resolutionConfidence: input.resolution?.resolutionConfidence ?? 0,
      needsConfirmation: true,
      suggestion: input.resolution?.suggestion ?? null,
    };
  }

  const warnings: string[] = [];

  if (!input.prerequisite) {
    warnings.push("未选择前置实验，结论仅供参考。");
  }
  const reagents = demoListReagents(input.labId);
  const rules = applicableRules(input.experimentType, input.direction);
  const evaluation = evaluateRules({ rules, reagents, lang: "zh" });

  if (rules.length === 0) {
    warnings.push("当前组合暂无适用规则，结论可能不完整。");
  }

  return {
    runId: uid("run"),
    status: evaluation.status,
    confidenceLabel: input.prerequisite ? "HIGH" : "MEDIUM",
    minMissing: evaluation.minMissing,
    recommendedMissing: evaluation.recommendedMissing,
    warnings,
    compatibilityIssues:
      input.experimentType === "WB"
        ? checkWbAntibodyCompatibility(
            reagents
              .flatMap((reagent) => (reagent.antibodyMeta ? [reagent.antibodyMeta] : []))
              .filter(
                (meta): meta is DemoAntibodyMeta & { role: "PRIMARY" | "SECONDARY" } => meta.role === "PRIMARY" || meta.role === "SECONDARY",
              ),
          )
        : [],
    resolvedExperimentType: input.experimentType,
    resolutionSource: input.resolution?.resolutionSource ?? "DIRECT",
    resolutionConfidence: input.resolution?.resolutionConfidence ?? 1,
    needsConfirmation: input.resolution?.needsConfirmation ?? false,
    suggestion: input.resolution?.suggestion ?? null,
  };
}

export async function demoResolveExperiment(input: {
  labId: string;
  userId: string;
  customExperimentName: string;
  experimentContext?: string;
  direction?: string;
  lang?: "zh" | "en";
  llmConfig?: RuntimeLlmConfig;
}) {
  const resolution = await resolveExperimentInput({
    customExperimentName: input.customExperimentName,
    experimentContext: input.experimentContext,
    directionCode: input.direction,
    lang: input.lang,
    llmConfig: input.llmConfig,
  });
  const store = readStore();
  let draftId: string | undefined;
  if (resolution.resolutionSource === "MODEL_SUGGESTION") {
    draftId = uid("exp-draft");
    store.experimentResolveDrafts.push({
      id: draftId,
      labId: input.labId,
      userId: input.userId,
      resolvedOutput: resolution,
      isConfirmed: false,
    });
    writeStore(store);
  }
  return { ...resolution, draftId };
}

export function demoConfirmExperimentResolution(draftId: string) {
  const store = readStore();
  const draft = store.experimentResolveDrafts.find((item) => item.id === draftId);
  if (!draft || draft.isConfirmed) {
    return { error: "Invalid draft", code: "INVALID_DRAFT" as const };
  }
  draft.isConfirmed = true;
  writeStore(store);
  return { draftId: draft.id, confirmed: true, resolvedOutput: draft.resolvedOutput };
}
