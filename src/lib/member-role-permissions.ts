export type MembershipRole = "PI" | "ADMIN" | "MEMBER";

/**
 * Whether an actor may grant a non-PI role.
 *
 * PI is deliberately excluded: changing laboratory ownership needs a separate
 * transfer workflow and must never be possible through member management.
 */
export function canGrantMemberRole(actorRole: MembershipRole, nextRole: MembershipRole) {
  if (nextRole === "PI") return false;
  if (actorRole === "PI") return true;
  return actorRole === "ADMIN" && nextRole === "MEMBER";
}

/**
 * Whether an actor may change another member's role.
 *
 * Administrators may only lower a non-PI administrator to MEMBER. A PI may
 * promote or demote any non-PI member. Neither role may alter a PI or itself.
 */
export function canUpdateMemberRole(
  actorRole: MembershipRole,
  targetRole: MembershipRole,
  nextRole: MembershipRole,
  isSelf: boolean,
) {
  if (isSelf || targetRole === "PI" || targetRole === nextRole) return false;
  return canGrantMemberRole(actorRole, nextRole);
}
