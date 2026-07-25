import { NextResponse } from "next/server";
import { z } from "zod";
import { LabRole } from "@prisma/client";
import { getLabAiPolicyView, upsertLabAiPolicy } from "@/lib/ai-policy";
import { canManageAiPolicy } from "@/lib/permissions";
import { requireUserFromRequest } from "@/lib/session";
import { assertLabAccess } from "@/lib/permissions";

const roleSchema = z.enum([LabRole.PI, LabRole.ADMIN, LabRole.MEMBER]);
const domainSchema = z.enum(["REAGENT", "EXPERIMENT"]);

const postSchema = z.object({
  labId: z.string().min(1),
  allowAutoLearn: z.boolean().default(false),
  allowedRoles: z.array(roleSchema).default([LabRole.PI]),
  enabledKnowledgeDomains: z.array(domainSchema).default(["REAGENT", "EXPERIMENT"]),
});

export async function GET(req: Request) {
  try {
    const user = await requireUserFromRequest(req);
    const { searchParams } = new URL(req.url);
    const labId = searchParams.get("labId")?.trim();
    if (!labId) {
      return NextResponse.json({ error: "Missing labId", code: "MISSING_LAB_ID" }, { status: 400 });
    }
    const membership = await assertLabAccess(user.id, labId);
    return NextResponse.json({
      labId,
      role: membership.role,
      canManage: canManageAiPolicy(membership.role),
      policy: await getLabAiPolicyView(labId),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "NO_LAB_ACCESS") {
      return NextResponse.json({ error: "Forbidden", code: "NO_LAB_ACCESS" }, { status: 403 });
    }
    return NextResponse.json({ error: "Load AI policy failed", code: "LOAD_AI_POLICY_FAILED" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUserFromRequest(req);
    const parsed = postSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", code: "INVALID_PAYLOAD" }, { status: 400 });
    }
    const membership = await assertLabAccess(user.id, parsed.data.labId);
    if (!canManageAiPolicy(membership.role)) {
      return NextResponse.json({ error: "Forbidden", code: "FORBIDDEN" }, { status: 403 });
    }
    await upsertLabAiPolicy(parsed.data.labId, {
      allowAutoLearn: parsed.data.allowAutoLearn,
      allowedRoles: parsed.data.allowedRoles,
      enabledKnowledgeDomains: parsed.data.enabledKnowledgeDomains,
    });
    return NextResponse.json({
      labId: parsed.data.labId,
      role: membership.role,
      canManage: true,
      policy: await getLabAiPolicyView(parsed.data.labId),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "NO_LAB_ACCESS") {
      return NextResponse.json({ error: "Forbidden", code: "NO_LAB_ACCESS" }, { status: 403 });
    }
    return NextResponse.json({ error: "Save AI policy failed", code: "SAVE_AI_POLICY_FAILED" }, { status: 500 });
  }
}
