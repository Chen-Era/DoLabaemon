import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/demo-mode";
import { assertLabAccess } from "@/lib/permissions";
import { requireUserFromRequest } from "@/lib/session";
import { demoGetAnimalCageAccessContext, demoUpdateAnimalCageResidents } from "@/lib/demo-store";
import { animalErrorResponse } from "@/lib/animal-manage/error-response";
import { getAnimalCageAccessContext, updateAnimalCageResidents } from "@/lib/animal-manage/manage-animals";
import { animalResidentUpdateSchema } from "@/lib/animal-manage/types";

type RouteParams = { params: Promise<{ cageId: string }> };

export async function POST(req: Request, { params }: RouteParams) {
  try {
    const user = await requireUserFromRequest(req);
    const { cageId } = await params;
    const parsed = animalResidentUpdateSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid payload", code: "INVALID_PAYLOAD" }, { status: 400 });
    const context = isDemoMode() ? demoGetAnimalCageAccessContext(cageId) : await getAnimalCageAccessContext(cageId);
    if (!context) throw new Error("ANIMAL_CAGE_NOT_FOUND");
    await assertLabAccess(user.id, context.labId);
    const result = isDemoMode()
      ? demoUpdateAnimalCageResidents(cageId, parsed.data, user.id)
      : await updateAnimalCageResidents(cageId, parsed.data, user.id);
    return NextResponse.json(result);
  } catch (error) {
    const mapped = animalErrorResponse(error);
    if (mapped) return mapped;
    console.error("[animals/cages/residents] failed:", error);
    return NextResponse.json({ error: "Failed to update cage residents", code: "ANIMAL_RESIDENT_UPDATE_FAILED" }, { status: 500 });
  }
}
