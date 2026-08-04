import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/demo-mode";
import { assertLabAccess } from "@/lib/permissions";
import { requireUserFromRequest } from "@/lib/session";
import {
  demoGetAnimalRack,
  demoGetAnimalRackAccessContext,
  demoUpdateAnimalRack,
} from "@/lib/demo-store";
import { animalErrorResponse } from "@/lib/animal-manage/error-response";
import { getAnimalRack, getAnimalRackAccessContext, updateAnimalRack } from "@/lib/animal-manage/manage-animals";
import { animalRackUpdateSchema } from "@/lib/animal-manage/types";

type RouteParams = { params: Promise<{ rackId: string }> };

async function resolveRackLabId(rackId: string) {
  const context = isDemoMode() ? demoGetAnimalRackAccessContext(rackId) : await getAnimalRackAccessContext(rackId);
  if (!context) throw new Error("ANIMAL_RACK_NOT_FOUND");
  return context.labId;
}

export async function GET(req: Request, { params }: RouteParams) {
  try {
    const user = await requireUserFromRequest(req);
    const { rackId } = await params;
    await assertLabAccess(user.id, await resolveRackLabId(rackId));
    const item = isDemoMode() ? demoGetAnimalRack(rackId) : await getAnimalRack(rackId);
    if (!item) throw new Error("ANIMAL_RACK_NOT_FOUND");
    return NextResponse.json({ item });
  } catch (error) {
    const mapped = animalErrorResponse(error);
    if (mapped) return mapped;
    console.error("[animals/racks/detail] failed:", error);
    return NextResponse.json({ error: "Failed to load animal rack", code: "ANIMAL_RACK_LOAD_FAILED" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const user = await requireUserFromRequest(req);
    const { rackId } = await params;
    const parsed = animalRackUpdateSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid payload", code: "INVALID_PAYLOAD" }, { status: 400 });
    await assertLabAccess(user.id, await resolveRackLabId(rackId));
    const item = isDemoMode() ? demoUpdateAnimalRack(rackId, parsed.data) : await updateAnimalRack(rackId, parsed.data);
    return NextResponse.json({ item });
  } catch (error) {
    const mapped = animalErrorResponse(error);
    if (mapped) return mapped;
    console.error("[animals/racks/update] failed:", error);
    return NextResponse.json({ error: "Failed to update animal rack", code: "ANIMAL_RACK_UPDATE_FAILED" }, { status: 500 });
  }
}
