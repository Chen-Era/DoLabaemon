import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/demo-mode";
import { assertLabAccess } from "@/lib/permissions";
import { requireUserFromRequest } from "@/lib/session";
import { demoGetAnimalCageAccessContext, demoResetAnimalCage } from "@/lib/demo-store";
import { animalErrorResponse } from "@/lib/animal-manage/error-response";
import { getAnimalCageAccessContext, resetAnimalCage } from "@/lib/animal-manage/manage-animals";
import { animalCageResetSchema } from "@/lib/animal-manage/types";

type RouteParams = { params: Promise<{ cageId: string }> };

async function resolveCageLabId(cageId: string) {
  const context = isDemoMode() ? demoGetAnimalCageAccessContext(cageId) : await getAnimalCageAccessContext(cageId);
  if (!context) throw new Error("ANIMAL_CAGE_NOT_FOUND");
  return context.labId;
}

/** Closes a cage card, preserves its audit history, and releases its position. */
export async function POST(req: Request, { params }: RouteParams) {
  try {
    const user = await requireUserFromRequest(req);
    const { cageId } = await params;
    // The reset date and reason are optional, so an empty request body means
    // "reset now". This also keeps the endpoint convenient for one-click UI
    // confirmations that do not need extra fields.
    const payload = await req.json().catch(() => ({}));
    const parsed = animalCageResetSchema.safeParse(payload);
    if (!parsed.success) return NextResponse.json({ error: "Invalid payload", code: "INVALID_PAYLOAD" }, { status: 400 });

    await assertLabAccess(user.id, await resolveCageLabId(cageId));
    const item = isDemoMode()
      ? demoResetAnimalCage(cageId, parsed.data, user.id)
      : await resetAnimalCage(cageId, parsed.data, user.id);
    return NextResponse.json({ item });
  } catch (error) {
    const mapped = animalErrorResponse(error);
    if (mapped) return mapped;
    console.error("[animals/cages/reset] failed:", error);
    return NextResponse.json({ error: "Failed to reset cage card", code: "ANIMAL_CAGE_RESET_FAILED" }, { status: 500 });
  }
}
