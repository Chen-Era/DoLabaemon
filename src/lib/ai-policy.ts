import { LabRole } from "@prisma/client";
import { isDemoMode } from "@/lib/demo-mode";
import { demoGetLabAiPolicy, demoUpsertLabAiPolicy } from "@/lib/demo-store";
import { prisma } from "@/lib/prisma";

export const knowledgeDomains = ["REAGENT", "EXPERIMENT"] as const;
export type KnowledgeDomain = (typeof knowledgeDomains)[number];

export type LabAiPolicyInput = {
  allowAutoLearn?: boolean;
  allowedRoles?: Array<LabRole | "PI" | "ADMIN" | "MEMBER">;
  enabledKnowledgeDomains?: KnowledgeDomain[];
};

function uniqueList<T extends string>(items: T[] | undefined, fallback: T[]) {
  const next = Array.isArray(items) ? items : fallback;
  return [...new Set(next)];
}

export async function getLabAiPolicy(labId: string) {
  if (isDemoMode()) {
    return demoGetLabAiPolicy(labId);
  }
  return prisma.labAiPolicy.findUnique({ where: { labId } });
}

export async function getLabAiPolicyView(labId: string) {
  const saved = await getLabAiPolicy(labId);
  return {
    allowAutoLearn: saved?.allowAutoLearn ?? false,
    allowedRoles: uniqueList(saved?.allowedRoles as LabRole[] | undefined, ["PI"]),
    enabledKnowledgeDomains: uniqueList(saved?.enabledKnowledgeDomains as KnowledgeDomain[] | undefined, [...knowledgeDomains]),
  };
}

export async function upsertLabAiPolicy(labId: string, input: LabAiPolicyInput) {
  const next = {
    labId,
    allowAutoLearn: input.allowAutoLearn ?? false,
    allowedRoles: uniqueList((input.allowedRoles as LabRole[] | undefined) ?? ["PI"], ["PI"]),
    enabledKnowledgeDomains: uniqueList(input.enabledKnowledgeDomains ?? [...knowledgeDomains], [...knowledgeDomains]),
  };

  if (isDemoMode()) {
    return demoUpsertLabAiPolicy(next);
  }

  return prisma.labAiPolicy.upsert({
    where: { labId },
    create: next,
    update: next,
  });
}

export function canAutoLearnWithPolicy(input: {
  policy: { allowAutoLearn: boolean; allowedRoles: Array<LabRole | "PI" | "ADMIN" | "MEMBER">; enabledKnowledgeDomains: string[] };
  role: LabRole | "PI" | "ADMIN" | "MEMBER";
  domain: KnowledgeDomain;
  autoLearnEnabled: boolean;
}) {
  return Boolean(
    input.autoLearnEnabled
      && input.policy.allowAutoLearn
      && input.policy.allowedRoles.includes(input.role)
      && input.policy.enabledKnowledgeDomains.includes(input.domain),
  );
}
