import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/demo-mode";
import { assertLabAccess } from "@/lib/permissions";
import { requireUserFromRequest } from "@/lib/session";
import { demoCreateAnimalOperations } from "@/lib/demo-store";
import { animalErrorResponse } from "@/lib/animal-manage/error-response";
import { createAnimalOperations } from "@/lib/animal-manage/manage-animals";
import { animalOperationCreateSchema } from "@/lib/animal-manage/types";

export async function POST(req: Request) {
  try {
    const user = await requireUserFromRequest(req);
    const parsed = animalOperationCreateSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid payload", code: "INVALID_PAYLOAD" }, { status: 400 });
    await assertLabAccess(user.id, parsed.data.labId);
    const result = isDemoMode()
      ? demoCreateAnimalOperations(parsed.data, user.id)
      : await createAnimalOperations(parsed.data, user.id);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const mapped = animalErrorResponse(error);
    if (mapped) return mapped;
    console.error("[animals/operations/create] failed:", error);
    return NextResponse.json({ error: "Failed to create mouse operation records", code: "ANIMAL_OPERATION_CREATE_FAILED" }, { status: 500 });
  }
}
