import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { evaluateRules } from "@/lib/rules/evaluate";
import { ruleCatalog, type ExperimentTag } from "@/lib/rules/catalog";
import { checkWbAntibodyCompatibility } from "@/lib/rules/wb-antibody-check";
import { resolveExperimentInput } from "@/lib/experiment/resolve";
import type { ExperimentResolution } from "@/lib/experiment-knowledge/types";
import type { ExperimentKnowledgeEntry } from "@/lib/experiment-knowledge/types";
import type { ExperimentTechnique } from "@/lib/experiment-techniques/types";
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
import { buildReagentUploadProvenance, LEGACY_REAGENT_UPLOADER_NAME, type ReagentUploader } from "@/lib/reagent-provenance";
import { normalizeVendor } from "@/lib/vendor-normalization";
import reagentKnowledgeCatalog from "@/lib/reagent-knowledge/catalog.json";
import experimentKnowledgeCatalog from "@/lib/experiment-knowledge/catalog.json";
import { canGrantMemberRole, canUpdateMemberRole } from "@/lib/member-role-permissions";

type Role = "PI" | "ADMIN" | "MEMBER";
type JoinRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

type DemoUser = { id: string; email: string; displayName?: string; passwordHash: string };
type DemoLab = { id: string; name: string };
type DemoMembership = { userId: string; labId: string; role: Role };
type DemoJoinRequest = {
  id: string;
  labId: string;
  userId: string;
  message?: string;
  status: JoinRequestStatus;
  createdAt: string;
  reviewedAt?: string | null;
  reviewerId?: string | null;
};
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
  storageCondition?: string | null;
  unit?: string | null;
  arrivalDate?: string | null;
  expiryDate?: string | null;
  quantity?: number | null;
  experimentTags: ExperimentTag[];
  antibodyMeta?: DemoAntibodyMeta | null;
  primerMeta?: DemoPrimerMeta | null;
  createdAt: string;
  uploadedById?: string | null;
  uploadedByName?: string | null;
  uploadedAt?: string | null;
};

export type DemoReagentWriteInput = {
  labId: string;
  name: string;
  catalogNo: string;
  category: ReagentCategory;
  subCategory?: string | null;
  vendor?: string | null;
  note?: string | null;
  storageCondition?: string | null;
  unit?: string | null;
  arrivalDate?: string | null;
  expiryDate?: string | null;
  quantity?: number | null;
  experimentTags?: ExperimentTag[];
  antibodyMeta?: DemoAntibodyMeta | null;
  primerMeta?: DemoPrimerMeta | null;
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

export type DemoTechniqueDraft = {
  id: string;
  labId: string;
  createdById: string;
  baseCode: string | null;
  baseRevision: number | null;
  status: "DRAFT" | "IN_REVIEW" | "APPROVED" | "REJECTED";
  source: "CURATED" | "AI_DRAFT";
  payload: unknown;
  reviewerId: string | null;
  reviewNote: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DemoTechniqueRevision = {
  id: string;
  code: string;
  revision: number;
  snapshot: ExperimentTechnique;
  contentHash: string;
  changeSummary: string;
  restoredFromRevision: number | null;
  labId: string | null;
  publishedById: string | null;
  createdAt: string;
};

type DemoStoreShape = {
  users: DemoUser[];
  labs: DemoLab[];
  memberships: DemoMembership[];
  joinRequests: DemoJoinRequest[];
  invites: Array<{ id: string; labId: string; email: string; role: Role }>;
  reagents: DemoReagent[];
  drafts: DemoDraft[];
  experimentResolveDrafts: DemoExperimentResolveDraft[];
  llmConfigs: DemoLlmConfig[];
  aiPolicies: DemoLabAiPolicy[];
  knowledgeMutationLogs: DemoKnowledgeMutationLog[];
  reagentKnowledgeEntries: DemoReagentKnowledgeEntry[];
  experimentKnowledgeEntries: DemoExperimentKnowledgeEntry[];
  techniqueDrafts: DemoTechniqueDraft[];
  techniqueOverrides: ExperimentTechnique[];
  techniqueRevisions: DemoTechniqueRevision[];
};

const configuredDemoStorePath = process.env.LAB_REAGENT_DEMO_STORE_PATH?.trim();
const DEMO_STORE_PATH = configuredDemoStorePath
  ? path.resolve(configuredDemoStorePath)
  : path.join(process.cwd(), ".data", "demo-store.json");
const DEMO_DATA_DIR = path.dirname(DEMO_STORE_PATH);
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
    joinRequests: [],
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
    techniqueDrafts: [],
    techniqueOverrides: [],
    techniqueRevisions: [],
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
    joinRequests: Array.isArray(parsed.joinRequests) ? parsed.joinRequests : [],
    invites: Array.isArray(parsed.invites) ? parsed.invites : [],
    reagents: Array.isArray(parsed.reagents) ? parsed.reagents : [],
    drafts: Array.isArray(parsed.drafts) ? parsed.drafts : [],
    experimentResolveDrafts: Array.isArray(parsed.experimentResolveDrafts) ? parsed.experimentResolveDrafts : [],
    llmConfigs: Array.isArray(parsed.llmConfigs) ? parsed.llmConfigs : [],
    aiPolicies: Array.isArray(parsed.aiPolicies) ? parsed.aiPolicies : base.aiPolicies,
    knowledgeMutationLogs: Array.isArray(parsed.knowledgeMutationLogs) ? parsed.knowledgeMutationLogs : [],
    reagentKnowledgeEntries: Array.isArray(parsed.reagentKnowledgeEntries) ? parsed.reagentKnowledgeEntries : base.reagentKnowledgeEntries,
    experimentKnowledgeEntries: Array.isArray(parsed.experimentKnowledgeEntries) ? parsed.experimentKnowledgeEntries : base.experimentKnowledgeEntries,
    techniqueDrafts: Array.isArray(parsed.techniqueDrafts) ? parsed.techniqueDrafts : [],
    techniqueOverrides: Array.isArray(parsed.techniqueOverrides) ? parsed.techniqueOverrides : [],
    techniqueRevisions: Array.isArray(parsed.techniqueRevisions) ? parsed.techniqueRevisions : [],
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

export function demoListTechniqueDrafts(labId: string) {
  const store = readStore();
  return store.techniqueDrafts
    .filter((draft) => draft.labId === labId)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function demoGetTechniqueDraft(draftId: string) {
  return readStore().techniqueDrafts.find((draft) => draft.id === draftId) ?? null;
}

export function demoCreateTechniqueDraft(
  input: Omit<DemoTechniqueDraft, "id" | "createdAt" | "updatedAt">,
) {
  const store = readStore();
  const now = new Date().toISOString();
  const draft: DemoTechniqueDraft = {
    ...input,
    id: uid("technique-draft"),
    createdAt: now,
    updatedAt: now,
  };
  store.techniqueDrafts.unshift(draft);
  writeStore(store);
  return draft;
}

export function demoUpdateTechniqueDraft(
  draftId: string,
  updates: Partial<Omit<DemoTechniqueDraft, "id" | "labId" | "createdById" | "createdAt">>,
) {
  const store = readStore();
  const draft = store.techniqueDrafts.find((item) => item.id === draftId);
  if (!draft) return null;
  Object.assign(draft, updates, { updatedAt: new Date().toISOString() });
  writeStore(store);
  return draft;
}

export function demoListTechniqueOverrides() {
  return readStore().techniqueOverrides;
}

export function demoUpsertTechniqueOverride(
  technique: ExperimentTechnique,
  meta?: {
    changeSummary?: string;
    restoredFromRevision?: number | null;
    labId?: string | null;
    publishedById?: string | null;
  },
) {
  const store = readStore();
  const index = store.techniqueOverrides.findIndex(
    (item) => item.code === technique.code,
  );
  if (index >= 0) store.techniqueOverrides[index] = technique;
  else store.techniqueOverrides.push(technique);
  const hasRevisionRecord = store.techniqueRevisions.some(
    (item) => item.code === technique.code && item.revision === technique.revision,
  );
  if (!hasRevisionRecord) {
    store.techniqueRevisions.push({
      id: uid("technique-revision"),
      code: technique.code,
      revision: technique.revision,
      snapshot: technique,
      contentHash: technique.contentHash,
      changeSummary: meta?.changeSummary ?? "Demo override published.",
      restoredFromRevision: meta?.restoredFromRevision ?? null,
      labId: meta?.labId ?? null,
      publishedById: meta?.publishedById ?? null,
      createdAt: new Date().toISOString(),
    });
  }
  writeStore(store);
  return technique;
}

export function demoListTechniqueRevisions(code: string): DemoTechniqueRevision[] {
  return readStore()
    .techniqueRevisions.filter((item) => item.code === code)
    .sort((left, right) => left.revision - right.revision);
}

export function demoGetTechniqueRevision(
  code: string,
  revision: number,
): DemoTechniqueRevision | null {
  return (
    readStore().techniqueRevisions.find(
      (item) => item.code === code && item.revision === revision,
    ) ?? null
  );
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

type DemoRegisterResult =
  | {
      error: string;
      code:
        | "EMAIL_EXISTS"
        | "INVALID_LAB_NAME"
        | "INVITE_NOT_FOUND"
        | "INVITE_EMAIL_MISMATCH"
        | "INVALID_INVITE_ROLE"
        | "LAB_NOT_FOUND";
    }
  | { userId: string; labId?: string; joinRequestId?: string; mode: "create" | "invite" | "request" | "none" };

export async function demoRegister(input: {
  email: string;
  password: string;
  displayName?: string;
  labName?: string;
  mode?: "create" | "invite" | "request" | "none";
  inviteCode?: string;
  requestLabId?: string;
  requestMessage?: string;
}): Promise<DemoRegisterResult> {
  const store = readStore();
  const email = normalizeEmail(input.email);
  const exists = store.users.find((x) => x.email === email);
  if (exists) {
    return { error: "Email already exists", code: "EMAIL_EXISTS" as const };
  }
  const mode = input.mode ?? "create";

  let invite: DemoStoreShape["invites"][number] | undefined;
  let requestLab: DemoLab | undefined;
  if (mode === "create") {
    if (!input.labName || input.labName.trim().length < 2) {
      return { error: "实验室名称不能为空", code: "INVALID_LAB_NAME" as const };
    }
  } else if (mode === "invite") {
    invite = store.invites.find((item) => item.id === input.inviteCode?.trim());
    if (!invite) {
      return { error: "邀请码无效", code: "INVITE_NOT_FOUND" as const };
    }
    if (invite.email !== email) {
      return { error: "该邀请码绑定的是其他邮箱", code: "INVITE_EMAIL_MISMATCH" as const };
    }
    if (invite.role === "PI") {
      return { error: "负责人角色不能通过邀请码授予", code: "INVALID_INVITE_ROLE" as const };
    }
  } else if (mode === "request") {
    requestLab = store.labs.find((lab) => lab.id === input.requestLabId);
    if (!requestLab) {
      return { error: "没有找到这个实验室", code: "LAB_NOT_FOUND" as const };
    }
  }

  const userId = uid("user");
  const user: DemoUser = {
    id: userId,
    email,
    passwordHash: await bcrypt.hash(input.password, 12),
  };
  if (input.displayName) {
    user.displayName = input.displayName;
  }
  store.users.push(user);

  if (mode === "create") {
    const labId = uid("lab");
    store.labs.push({ id: labId, name: input.labName!.trim() });
    store.memberships.push({ userId, labId, role: "PI" });
    store.aiPolicies.push({
      labId,
      allowAutoLearn: false,
      allowedRoles: ["PI"],
      enabledKnowledgeDomains: ["REAGENT", "EXPERIMENT"],
    });
    writeStore(store);
    return { userId, labId, mode };
  }

  if (mode === "invite" && invite) {
    store.memberships.push({ userId, labId: invite.labId, role: invite.role });
    store.invites = store.invites.filter((item) => item.id !== invite!.id);
    writeStore(store);
    return { userId, labId: invite.labId, mode };
  }

  if (mode === "request" && requestLab) {
    const joinRequest: DemoJoinRequest = {
      id: uid("join-request"),
      labId: requestLab.id,
      userId,
      message: input.requestMessage?.trim() || undefined,
      status: "PENDING",
      createdAt: new Date().toISOString(),
    };
    store.joinRequests.push(joinRequest);
    writeStore(store);
    return { userId, joinRequestId: joinRequest.id, mode };
  }

  writeStore(store);
  return { userId, mode };
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
  if (!me || !canGrantMemberRole(me.role, input.role)) {
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
  if (invite.role === "PI") {
    return { error: "负责人角色不能通过邀请码授予", code: "INVALID_INVITE_ROLE" as const };
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

export function demoSearchLabs(query: string, limit = 8) {
  const store = readStore();
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return store.labs
    .filter((lab) => lab.name.toLowerCase().includes(q))
    .slice(0, limit)
    .map((lab) => ({
      id: lab.id,
      name: lab.name,
      memberCount: store.memberships.filter((membership) => membership.labId === lab.id).length,
    }));
}

export function demoCreateJoinRequest(input: { userId: string; labId: string; message?: string }) {
  const store = readStore();
  const lab = store.labs.find((item) => item.id === input.labId);
  if (!lab) {
    return { error: "没有找到这个实验室", code: "LAB_NOT_FOUND" as const };
  }
  const alreadyMember = store.memberships.find((item) => item.userId === input.userId && item.labId === lab.id);
  if (alreadyMember) {
    return { error: "你已加入该实验室", code: "ALREADY_IN_LAB" as const };
  }
  const existing = store.joinRequests.find(
    (item) => item.userId === input.userId && item.labId === lab.id && item.status === "PENDING",
  );
  if (existing) {
    return { error: "你已经提交过申请，请等待审批", code: "REQUEST_ALREADY_PENDING" as const };
  }
  const joinRequest: DemoJoinRequest = {
    id: uid("join-request"),
    labId: lab.id,
    userId: input.userId,
    message: input.message?.trim() || undefined,
    status: "PENDING",
    createdAt: new Date().toISOString(),
  };
  store.joinRequests.push(joinRequest);
  writeStore(store);
  return { joinRequestId: joinRequest.id };
}

export function demoListJoinRequests(userId: string) {
  const store = readStore();
  const mine = store.joinRequests
    .filter((item) => item.userId === userId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .map((item) => ({
      ...item,
      lab: { id: item.labId, name: store.labs.find((lab) => lab.id === item.labId)?.name ?? "已删除的实验室" },
    }));
  const managedLabIds = store.memberships
    .filter((item) => item.userId === userId && (item.role === "PI" || item.role === "ADMIN"))
    .map((item) => item.labId);
  const pending = store.joinRequests
    .filter((item) => item.status === "PENDING" && managedLabIds.includes(item.labId))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .map((item) => {
      const requester = store.users.find((user) => user.id === item.userId);
      return {
        ...item,
        lab: { id: item.labId, name: store.labs.find((lab) => lab.id === item.labId)?.name ?? "已删除的实验室" },
        user: {
          id: item.userId,
          email: requester?.email ?? "未知用户",
          displayName: requester?.displayName ?? null,
        },
      };
    });
  return { mine, pending };
}

export function demoReviewJoinRequest(input: { requestId: string; reviewerId: string; action: "approve" | "reject" }) {
  const store = readStore();
  const joinRequest = store.joinRequests.find((item) => item.id === input.requestId);
  if (!joinRequest || joinRequest.status !== "PENDING") {
    return { error: "申请不存在或已处理", code: "REQUEST_NOT_FOUND" as const };
  }
  const membership = store.memberships.find(
    (item) => item.userId === input.reviewerId && item.labId === joinRequest.labId,
  );
  if (!membership || (membership.role !== "PI" && membership.role !== "ADMIN")) {
    return { error: "Permission denied", code: "PERMISSION_DENIED" as const };
  }
  joinRequest.reviewedAt = new Date().toISOString();
  joinRequest.reviewerId = input.reviewerId;
  if (input.action === "approve") {
    const alreadyMember = store.memberships.find(
      (item) => item.userId === joinRequest.userId && item.labId === joinRequest.labId,
    );
    if (!alreadyMember) {
      store.memberships.push({ userId: joinRequest.userId, labId: joinRequest.labId, role: "MEMBER" });
    }
    joinRequest.status = "APPROVED";
  } else {
    joinRequest.status = "REJECTED";
  }
  writeStore(store);
  return { joinRequestId: joinRequest.id, status: joinRequest.status, labId: joinRequest.labId };
}

export function demoListLabMembers(labId: string) {
  const store = readStore();
  return store.memberships
    .filter((item) => item.labId === labId)
    .map((item) => {
      const user = store.users.find((candidate) => candidate.id === item.userId);
      return {
        userId: item.userId,
        role: item.role,
        email: user?.email ?? "未知用户",
        displayName: user?.displayName ?? null,
      };
    });
}

export function demoRemoveLabMember(input: { actorId: string; labId: string; targetUserId: string }) {
  const store = readStore();
  const actor = store.memberships.find((item) => item.userId === input.actorId && item.labId === input.labId);
  if (!actor) {
    return { error: "Permission denied", code: "PERMISSION_DENIED" as const };
  }
  const target = store.memberships.find((item) => item.userId === input.targetUserId && item.labId === input.labId);
  if (!target) {
    return { error: "该成员不在实验室中", code: "MEMBER_NOT_FOUND" as const };
  }
  const isSelf = input.actorId === input.targetUserId;
  const allowed =
    !isSelf &&
    ((actor.role === "PI" && target.role !== "PI") || (actor.role === "ADMIN" && target.role === "MEMBER"));
  if (!allowed) {
    return { error: "Permission denied", code: "PERMISSION_DENIED" as const };
  }
  store.memberships = store.memberships.filter((item) => item !== target);
  writeStore(store);
  return { removedUserId: input.targetUserId };
}

export function demoUpdateLabMemberRole(input: { actorId: string; labId: string; targetUserId: string; role: Role }) {
  const store = readStore();
  const actor = store.memberships.find((item) => item.userId === input.actorId && item.labId === input.labId);
  const target = store.memberships.find((item) => item.userId === input.targetUserId && item.labId === input.labId);
  if (!target) {
    return { error: "该成员不在实验室中", code: "MEMBER_NOT_FOUND" as const };
  }
  if (!actor || !canUpdateMemberRole(actor.role, target.role, input.role, input.actorId === input.targetUserId)) {
    return { error: "Permission denied", code: "PERMISSION_DENIED" as const };
  }
  target.role = input.role;
  writeStore(store);
  return { userId: target.userId, role: target.role };
}

export function demoDeleteLab(input: { userId: string; labId: string }) {
  const store = readStore();
  const membership = store.memberships.find((item) => item.userId === input.userId && item.labId === input.labId);
  if (!membership || membership.role !== "PI") {
    return { error: "Permission denied", code: "PERMISSION_DENIED" as const };
  }
  const labId = input.labId;
  store.labs = store.labs.filter((lab) => lab.id !== labId);
  store.memberships = store.memberships.filter((item) => item.labId !== labId);
  store.joinRequests = store.joinRequests.filter((item) => item.labId !== labId);
  store.invites = store.invites.filter((item) => item.labId !== labId);
  store.reagents = store.reagents.filter((item) => item.labId !== labId);
  store.drafts = store.drafts.filter((item) => item.labId !== labId);
  store.experimentResolveDrafts = store.experimentResolveDrafts.filter((item) => item.labId !== labId);
  store.aiPolicies = store.aiPolicies.filter((item) => item.labId !== labId);
  store.knowledgeMutationLogs = store.knowledgeMutationLogs.filter((item) => item.labId !== labId);
  store.techniqueDrafts = store.techniqueDrafts.filter((item) => item.labId !== labId);
  writeStore(store);
  return { deletedLabId: labId };
}

export function demoListInvites(labId: string, viewerRole: Role = "PI") {
  const store = readStore();
  return store.invites
    .filter((item) => item.labId === labId && (viewerRole === "PI" || item.role === "MEMBER"))
    .map((item) => ({ id: item.id, email: item.email, role: item.role }));
}

export function demoListReagents(labId: string) {
  const store = readStore();
  return store.reagents
    .filter((x) => x.labId === labId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .map((reagent) => ({
      ...reagent,
      uploadedByName: reagent.uploadedByName ?? LEGACY_REAGENT_UPLOADER_NAME,
      uploadedAt: reagent.uploadedAt ?? reagent.createdAt,
    }));
}

function demoUploader(store: DemoStoreShape, uploader?: ReagentUploader): ReagentUploader {
  if (uploader) return uploader;
  const user = store.users[0];
  return {
    id: user?.id ?? "demo-user",
    name: user?.displayName,
    email: user?.email,
  };
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
}, uploader?: ReagentUploader) {
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
  const now = new Date().toISOString();
  store.reagents.push({
    id: reagentId,
    labId: input.editedPayload.labId,
    name: input.editedPayload.name,
    catalogNo: input.editedPayload.catalogNo,
    category: input.editedPayload.category,
    subCategory: input.editedPayload.subCategory,
    vendor: normalizeVendor(input.editedPayload.vendor),
    note: input.editedPayload.note,
    quantity: 1,
    experimentTags: input.editedPayload.experimentTags ?? draft.parsedOutput.experimentTags,
    antibodyMeta: input.editedPayload.antibodyMeta ?? draft.parsedOutput.antibodyMeta,
    primerMeta: input.editedPayload.primerMeta ?? draft.parsedOutput.primerMeta,
    createdAt: now,
    uploadedAt: now,
    ...buildReagentUploadProvenance(demoUploader(store, uploader)),
  });
  writeStore(store);
  return { action: "created" as const, reagentId };
}

function demoAdjustedQuantity(current: number | null | undefined, delta: number) {
  const baseline = typeof current === "number" && Number.isFinite(current) ? current : 0;
  return Math.round(Math.max(0, baseline + delta) * 1000) / 1000;
}

export function demoCreateReagent(input: DemoReagentWriteInput, uploader?: ReagentUploader) {
  const store = readStore();
  const existing = store.reagents.find(
    (reagent) => reagent.labId === input.labId && reagent.catalogNo === input.catalogNo,
  );
  if (existing) {
    return { error: "该货号在当前实验室已存在，可直接编辑原有记录。", code: "CATALOG_NO_EXISTS" as const };
  }
  const now = new Date().toISOString();
  const reagent: DemoReagent = {
    id: uid("reagent"),
    labId: input.labId,
    name: input.name,
    catalogNo: input.catalogNo,
    category: input.category,
    subCategory: input.subCategory ?? null,
    vendor: normalizeVendor(input.vendor),
    note: input.note ?? null,
    storageCondition: input.storageCondition ?? null,
    unit: input.unit ?? null,
    arrivalDate: input.arrivalDate ?? null,
    expiryDate: input.expiryDate ?? null,
    quantity: typeof input.quantity === "number" ? input.quantity : null,
    experimentTags: input.experimentTags ?? [],
    antibodyMeta: input.antibodyMeta ?? null,
    primerMeta: input.primerMeta ?? null,
    createdAt: now,
    uploadedAt: now,
    ...buildReagentUploadProvenance(demoUploader(store, uploader)),
  };
  store.reagents.push(reagent);
  writeStore(store);
  return reagent;
}

export function demoGetReagentLabId(reagentId: string) {
  const reagent = readStore().reagents.find((item) => item.id === reagentId);
  return reagent ? { id: reagent.id, labId: reagent.labId } : null;
}

export function demoUpdateReagent(reagentId: string, input: Omit<DemoReagentWriteInput, "labId">) {
  const store = readStore();
  const reagent = store.reagents.find((item) => item.id === reagentId);
  if (!reagent) {
    return { error: "没有找到这条试剂记录。", code: "REAGENT_NOT_FOUND" as const };
  }
  if (input.catalogNo !== reagent.catalogNo) {
    const conflict = store.reagents.find(
      (item) => item.id !== reagentId && item.labId === reagent.labId && item.catalogNo === input.catalogNo,
    );
    if (conflict) {
      return { error: "该货号在当前实验室已存在，可直接编辑原有记录。", code: "CATALOG_NO_EXISTS" as const };
    }
  }
  reagent.name = input.name;
  reagent.catalogNo = input.catalogNo;
  reagent.category = input.category;
  reagent.subCategory = input.subCategory ?? null;
  reagent.vendor = normalizeVendor(input.vendor);
  reagent.note = input.note ?? null;
  reagent.storageCondition = input.storageCondition ?? null;
  reagent.unit = input.unit ?? null;
  reagent.arrivalDate = input.arrivalDate ?? null;
  reagent.expiryDate = input.expiryDate ?? null;
  reagent.quantity = typeof input.quantity === "number" ? input.quantity : null;
  reagent.experimentTags = input.experimentTags ?? [];
  reagent.antibodyMeta = input.antibodyMeta ?? null;
  reagent.primerMeta = input.primerMeta ?? null;
  writeStore(store);
  return reagent;
}

export function demoDeleteReagent(reagentId: string) {
  const store = readStore();
  const exists = store.reagents.some((item) => item.id === reagentId);
  if (!exists) {
    return { error: "没有找到这条试剂记录。", code: "REAGENT_NOT_FOUND" as const };
  }
  store.reagents = store.reagents.filter((item) => item.id !== reagentId);
  writeStore(store);
  return { deletedReagentId: reagentId };
}

export function demoDeleteReagents(labId: string, ids: string[]) {
  const store = readStore();
  const idSet = new Set(ids);
  const before = store.reagents.length;
  store.reagents = store.reagents.filter((item) => !(item.labId === labId && idSet.has(item.id)));
  writeStore(store);
  return { deletedCount: before - store.reagents.length };
}

export function demoAdjustReagentQuantity(reagentId: string, delta: number) {
  const store = readStore();
  const reagent = store.reagents.find((item) => item.id === reagentId);
  if (!reagent) {
    return { error: "没有找到这条试剂记录。", code: "REAGENT_NOT_FOUND" as const };
  }
  const beforeQuantity = reagent.quantity ?? null;
  const afterQuantity = demoAdjustedQuantity(beforeQuantity, delta);
  reagent.quantity = afterQuantity;
  writeStore(store);
  return { reagentId, beforeQuantity, afterQuantity };
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
