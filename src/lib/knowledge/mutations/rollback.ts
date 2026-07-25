import { getKnowledgeMutationLog, rollbackKnowledgeMutationLog } from "@/lib/knowledge/logs";
import {
  deleteRuntimeExperimentKnowledgeEntry,
  deleteRuntimeReagentKnowledgeEntry,
  upsertRuntimeExperimentKnowledgeEntry,
  upsertRuntimeReagentKnowledgeEntry,
} from "@/lib/knowledge/runtime-store";

export async function rollbackKnowledgeMutation(logId: string) {
  const log = await getKnowledgeMutationLog(logId);
  if (!log) {
    return { error: "LOG_NOT_FOUND" as const };
  }

  if (log.domain === "REAGENT") {
    if (log.beforeData) {
      await upsertRuntimeReagentKnowledgeEntry(log.beforeData as Parameters<typeof upsertRuntimeReagentKnowledgeEntry>[0]);
    } else {
      await deleteRuntimeReagentKnowledgeEntry(log.entityKey);
    }
  } else if (log.domain === "EXPERIMENT") {
    if (log.beforeData) {
      await upsertRuntimeExperimentKnowledgeEntry(log.beforeData as Parameters<typeof upsertRuntimeExperimentKnowledgeEntry>[0]);
    } else {
      await deleteRuntimeExperimentKnowledgeEntry(log.entityKey);
    }
  }

  return rollbackKnowledgeMutationLog(logId);
}
