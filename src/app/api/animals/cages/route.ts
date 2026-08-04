import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/demo-mode";
import { assertLabAccess } from "@/lib/permissions";
import { requireUserFromRequest } from "@/lib/session";
import { demoCreateAnimalCage } from "@/lib/demo-store";
import { animalErrorResponse } from "@/lib/animal-manage/error-response";
import { createAnimalCage } from "@/lib/animal-manage/manage-animals";
import { animalCageCreateSchema } from "@/lib/animal-manage/types";

export async function POST(req: Request) {
  try {
    const user = await requireUserFromRequest(req);
    const parsed = animalCageCreateSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid payload", code: "INVALID_PAYLOAD" }, { status: 400 });
    await assertLabAccess(user.id, parsed.data.labId);
    const item = isDemoMode()
      ? demoCreateAnimalCage(parsed.data, user.id)
      : await createAnimalCage(parsed.data, user.id);
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    const mapped = animalErrorResponse(error);
    if (mapped) return mapped;
    console.error("[animals/cages/create] failed:", error);
    return NextResponse.json({ error: "Failed to create cage card", code: "ANIMAL_CAGE_CREATE_FAILED" }, { status: 500 });
  }
}
