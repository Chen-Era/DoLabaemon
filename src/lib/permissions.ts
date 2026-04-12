import { LabRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function assertLabAccess(userId: string, labId: string) {
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
