import { LabRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isDemoMode } from "@/lib/demo-mode";
import { demoGetLabMembership } from "@/lib/demo-store";

export async function assertLabAccess(userId: string, labId: string) {
  if (isDemoMode()) {
    const membership = demoGetLabMembership(userId, labId);
    if (!membership) {
      throw new Error("NO_LAB_ACCESS");
    }
    return membership;
  }
  const membership = await prisma.labMember.findUnique({
    where: { userId_labId: { userId, labId } },
  });
  if (!membership) {
    throw new Error("NO_LAB_ACCESS");
  }
  return membership;
}

export function canInvite(role: LabRole) {
  return role === "PI" || role === "ADMIN";
}

export function canManageAiPolicy(role: LabRole | "PI" | "ADMIN" | "MEMBER") {
  return role === "PI" || role === "ADMIN";
}

export function canReviewExperimentTechniques(
  role: LabRole | "PI" | "ADMIN" | "MEMBER",
) {
  return role === "PI" || role === "ADMIN";
}
