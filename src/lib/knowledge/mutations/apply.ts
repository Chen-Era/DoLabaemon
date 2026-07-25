import { createKnowledgeMutationLog } from "@/lib/knowledge/logs";
import type { ExperimentKnowledgeEntry } from "@/lib/experiment-knowledge/types";
import type { ReagentKnowledgeEntry } from "@/lib/reagent-knowledge/types";
import {
  buildLearnedExperimentKnowledgeEntry,
  buildLearnedReagentKnowledgeEntry,
  getRuntimeExperimentKnowledgeEntry,
  getRuntimeReagentKnowledgeEntry,
  upsertRuntimeExperimentKnowledgeEntry,
  upsertRuntimeReagentKnowledgeEntry,
} from "@/lib/knowledge/runtime-store";
import { validateKnowledgeMutation } from "@/lib/knowledge/mutations/validate";

export async function applyKnowledgeMutation(input: {
  labId: string;
  userId: string;
  flowType: string;
  domain: string;
  entityKey: string;
  beforeData?: unknown;
  afterData?: unknown;
  evidenceSummary?: string[];
  modelName?: string | null;
  selfCheckOk: boolean;
}) {
  const knowledgeId = input.domain === "REAGENT"
    ? `reagent-${input.entityKey.split("::")[0]?.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-").replace(/^-+|-+$/g, "") || "entry"}`
    : `experiment-${input.entityKey.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-").replace(/^-+|-+$/g, "") || "entry"}`;
  const actualBeforeData = input.beforeData
    ?? (input.domain === "REAGENT"
      ? await getRuntimeReagentKnowledgeEntry(knowledgeId)
      : await getRuntimeExperimentKnowledgeEntry(knowledgeId));
  const actualAfterData =
    input.afterData
    && (input.domain === "REAGENT"
      ? buildLearnedReagentKnowledgeEntry({ entityKey: input.entityKey, parsed: input.afterData as Record<string, unknown> })
      : buildLearnedExperimentKnowledgeEntry({ entityKey: input.entityKey, suggestion: input.afterData as Record<string, unknown> }));

  const validation = validateKnowledgeMutation({
    domain: input.domain,
    beforeData: actualBeforeData,
    afterData: actualAfterData,
    selfCheckOk: input.selfCheckOk,
  });

  const status = validation.ok ? "APPLIED" : "BLOCKED";
  if (validation.ok && actualAfterData) {
    if (input.domain === "REAGENT") {
      await upsertRuntimeReagentKnowledgeEntry(actualAfterData as ReagentKnowledgeEntry);
    } else {
      await upsertRuntimeExperimentKnowledgeEntry(actualAfterData as ExperimentKnowledgeEntry);
    }
  }
  const log = await createKnowledgeMutationLog({
    labId: input.labId,
    userId: input.userId,
    flowType: input.flowType,
    domain: input.domain,
    entityKey: knowledgeId,
    beforeData: actualBeforeData,
    afterData: actualAfterData,
    evidenceSummary: input.evidenceSummary,
    modelName: input.modelName,
    status,
  });

  return {
    status,
    validation,
    log,
  };
}
