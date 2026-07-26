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

export function canReviewJoinRequests(role: LabRole | "PI" | "ADMIN" | "MEMBER") {
  return role === "PI" || role === "ADMIN";
}

export function canDeleteLab(role: LabRole | "PI" | "ADMIN" | "MEMBER") {
  return role === "PI";
}

/**
 * Who may remove whom from a lab:
 * - nobody removes themselves through member management (they should leave/transfer instead)
 * - PI can remove ADMIN and MEMBER, but not another PI
 * - ADMIN can only remove MEMBER
 */
export function canRemoveMember(
  actorRole: LabRole | "PI" | "ADMIN" | "MEMBER",
  targetRole: LabRole | "PI" | "ADMIN" | "MEMBER",
  isSelf: boolean,
) {
  if (isSelf) return false;
  if (actorRole === "PI") return targetRole !== "PI";
  if (actorRole === "ADMIN") return targetRole === "MEMBER";
  return false;
}

export function canManageAiPolicy(role: LabRole | "PI" | "ADMIN" | "MEMBER") {
  return role === "PI" || role === "ADMIN";
}

export function canReviewExperimentTechniques(
  role: LabRole | "PI" | "ADMIN" | "MEMBER",
) {
  return role === "PI" || role === "ADMIN";
}
