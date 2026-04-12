import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertLabAccess, canInvite } from "@/lib/permissions";
import { requireUserFromRequest } from "@/lib/session";
import { isDemoMode } from "@/lib/demo-mode";
import { demoCreateInvite } from "@/lib/demo-store";

const schema = z.object({
  labId: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["PI", "ADMIN", "MEMBER"]),
});

export async function POST(req: Request) {
  try {
    const user = await requireUserFromRequest(req);
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", code: "INVALID_PAYLOAD" }, { status: 400 });
    }
    if (isDemoMode()) {
      const out = demoCreateInvite({
        userId: user.id,
        labId: parsed.data.labId,
        email: parsed.data.email,
        role: parsed.data.role,
      });
      if ("error" in out) {
        return NextResponse.json({ error: out.error, code: out.code }, { status: 403 });
      }
      return NextResponse.json(out);
    }
    const membership = await assertLabAccess(user.id, parsed.data.labId);
    if (!canInvite(membership.role)) {
      return NextResponse.json({ error: "Permission denied", code: "PERMISSION_DENIED" }, { status: 403 });
    }
    const invite = await prisma.invitation.create({
      data: {
        labId: parsed.data.labId,
        email: parsed.data.email,
        role: parsed.data.role,
        invitedById: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      },
    });
    return NextResponse.json({ inviteId: invite.id });
  } catch {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }
}
