import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/demo-mode";
import { assertLabAccess } from "@/lib/permissions";
import { requireUserFromRequest } from "@/lib/session";
import { demoGetAnimalCageAccessContext, demoUpdateAnimalCage } from "@/lib/demo-store";
import { animalErrorResponse } from "@/lib/animal-manage/error-response";
import { getAnimalCageAccessContext, updateAnimalCage } from "@/lib/animal-manage/manage-animals";
import { animalCageUpdateSchema } from "@/lib/animal-manage/types";

type RouteParams = { params: Promise<{ cageId: string }> };

async function resolveCageLabId(cageId: string) {
  const context = isDemoMode() ? demoGetAnimalCageAccessContext(cageId) : await getAnimalCageAccessContext(cageId);
  if (!context) throw new Error("ANIMAL_CAGE_NOT_FOUND");
  return context.labId;
}

export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const user = await requireUserFromRequest(req);
    const { cageId } = await params;
    const parsed = animalCageUpdateSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid payload", code: "INVALID_PAYLOAD" }, { status: 400 });
    await assertLabAccess(user.id, await resolveCageLabId(cageId));
    const item = isDemoMode() ? demoUpdateAnimalCage(cageId, parsed.data) : await updateAnimalCage(cageId, parsed.data);
    return NextResponse.json({ item });
  } catch (error) {
    const mapped = animalErrorResponse(error);
    if (mapped) return mapped;
    console.error("[animals/cages/update] failed:", error);
    return NextResponse.json({ error: "Failed to update cage card", code: "ANIMAL_CAGE_UPDATE_FAILED" }, { status: 500 });
  }
}
