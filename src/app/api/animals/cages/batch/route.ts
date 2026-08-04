import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/demo-mode";
import { assertLabAccess } from "@/lib/permissions";
import { requireUserFromRequest } from "@/lib/session";
import { demoCreateAnimalCagesBatch } from "@/lib/demo-store";
import { animalErrorResponse } from "@/lib/animal-manage/error-response";
import { createAnimalCagesBatch } from "@/lib/animal-manage/manage-animals";
import { animalCageBatchCreateSchema } from "@/lib/animal-manage/types";

/** Creates cage cards with shared tag fields across several empty positions. */
export async function POST(req: Request) {
  try {
    const user = await requireUserFromRequest(req);
    const parsed = animalCageBatchCreateSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid payload", code: "INVALID_PAYLOAD" }, { status: 400 });
    await assertLabAccess(user.id, parsed.data.labId);
    const items = isDemoMode()
      ? demoCreateAnimalCagesBatch(parsed.data, user.id)
      : await createAnimalCagesBatch(parsed.data, user.id);
    return NextResponse.json({ items }, { status: 201 });
  } catch (error) {
    const mapped = animalErrorResponse(error);
    if (mapped) return mapped;
    console.error("[animals/cages/batch] failed:", error);
    return NextResponse.json({ error: "Failed to create cage cards", code: "ANIMAL_CAGE_BATCH_CREATE_FAILED" }, { status: 500 });
  }
}
