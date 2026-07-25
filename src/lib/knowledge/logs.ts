import { isDemoMode } from "@/lib/demo-mode";
import type { Prisma } from "@prisma/client";
import {
  demoCreateKnowledgeMutationLog,
  demoGetKnowledgeMutationLog,
  demoListKnowledgeMutationLogs,
  demoRollbackKnowledgeMutationLog,
} from "@/lib/demo-store";
import { toSafeJsonValue } from "@/lib/json/safe-json";
import { prisma } from "@/lib/prisma";

export type KnowledgeMutationInput = {
  labId: string;
  userId: string;
  flowType: string;
  domain: string;
  entityKey: string;
  status: string;
  beforeData?: unknown;
  afterData?: unknown;
  evidenceSummary?: string[];
  modelName?: string | null;
};

export async function createKnowledgeMutationLog(input: KnowledgeMutationInput) {
  if (isDemoMode()) {
    return demoCreateKnowledgeMutationLog({
      ...input,
      evidenceSummary: input.evidenceSummary ?? [],
    });
  }

  return prisma.knowledgeMutationLog.create({
    data: {
      ...input,
      beforeData: input.beforeData === undefined ? undefined : (toSafeJsonValue(input.beforeData) as Prisma.InputJsonValue),
      afterData: input.afterData === undefined ? undefined : (toSafeJsonValue(input.afterData) as Prisma.InputJsonValue),
      evidenceSummary: input.evidenceSummary ?? [],
    },
  });
}

export async function listKnowledgeMutationLogs(labId: string) {
  if (isDemoMode()) {
    return demoListKnowledgeMutationLogs(labId);
  }
  return prisma.knowledgeMutationLog.findMany({
    where: { labId },
    orderBy: { createdAt: "desc" },
  });
}

export async function rollbackKnowledgeMutationLog(logId: string) {
  if (isDemoMode()) {
    return demoRollbackKnowledgeMutationLog(logId);
  }
  return prisma.knowledgeMutationLog.update({
    where: { id: logId },
    data: {
      status: "ROLLED_BACK",
      rolledBackAt: new Date(),
    },
  });
}

export async function getKnowledgeMutationLog(logId: string) {
  if (isDemoMode()) {
    return demoGetKnowledgeMutationLog(logId);
  }
  return prisma.knowledgeMutationLog.findUnique({ where: { id: logId } });
}
