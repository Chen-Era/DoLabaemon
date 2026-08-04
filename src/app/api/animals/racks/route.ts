import { NextResponse } from "next/server";
import { z } from "zod";
import { isDemoMode } from "@/lib/demo-mode";
import { assertLabAccess } from "@/lib/permissions";
import { requireUserFromRequest } from "@/lib/session";
import {
  demoCreateAnimalRack,
  demoListAnimalRacks,
} from "@/lib/demo-store";
import { animalErrorResponse } from "@/lib/animal-manage/error-response";
import { createAnimalRack, listAnimalRacks } from "@/lib/animal-manage/manage-animals";
import { animalRackCreateSchema } from "@/lib/animal-manage/types";

export const dynamic = "force-dynamic";

const listSchema = z.object({ labId: z.string().trim().min(1) });

export async function GET(req: Request) {
  try {
    const user = await requireUserFromRequest(req);
    const parsed = listSchema.safeParse({ labId: new URL(req.url).searchParams.get("labId") });
    if (!parsed.success) return NextResponse.json({ error: "Missing labId", code: "MISSING_LAB_ID" }, { status: 400 });
    await assertLabAccess(user.id, parsed.data.labId);
    const items = isDemoMode() ? demoListAnimalRacks(parsed.data.labId) : await listAnimalRacks(parsed.data.labId);
    return NextResponse.json({ items });
  } catch (error) {
    const mapped = animalErrorResponse(error);
    if (mapped) return mapped;
    console.error("[animals/racks/list] failed:", error);
    return NextResponse.json({ error: "Failed to load animal racks", code: "ANIMAL_RACKS_LOAD_FAILED" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUserFromRequest(req);
    const parsed = animalRackCreateSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid payload", code: "INVALID_PAYLOAD" }, { status: 400 });
    await assertLabAccess(user.id, parsed.data.labId);
    const item = isDemoMode() ? demoCreateAnimalRack(parsed.data) : await createAnimalRack(parsed.data);
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    const mapped = animalErrorResponse(error);
    if (mapped) return mapped;
    console.error("[animals/racks/create] failed:", error);
    return NextResponse.json({ error: "Failed to create animal rack", code: "ANIMAL_RACK_CREATE_FAILED" }, { status: 500 });
  }
}
