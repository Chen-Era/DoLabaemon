import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/demo-mode";
import { assertLabAccess } from "@/lib/permissions";
import { requireUserFromRequest } from "@/lib/session";
import { demoBatchAdmitAnimalCages } from "@/lib/demo-store";
import { animalErrorResponse } from "@/lib/animal-manage/error-response";
import { admitAnimalCageResidentsBatch } from "@/lib/animal-manage/manage-animals";
import { animalBatchAdmissionSchema } from "@/lib/animal-manage/types";

/** Adds the same number of mice to several cage cards or all active cards in a rack. */
export async function POST(req: Request) {
  try {
    const user = await requireUserFromRequest(req);
    const parsed = animalBatchAdmissionSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid payload", code: "INVALID_PAYLOAD" }, { status: 400 });
    await assertLabAccess(user.id, parsed.data.labId);
    const result = isDemoMode()
      ? demoBatchAdmitAnimalCages(parsed.data, user.id)
      : await admitAnimalCageResidentsBatch(parsed.data, user.id);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const mapped = animalErrorResponse(error);
    if (mapped) return mapped;
    console.error("[animals/residents/batch] failed:", error);
    return NextResponse.json({ error: "Failed to batch admit cage residents", code: "ANIMAL_BATCH_ADMISSION_FAILED" }, { status: 500 });
  }
}
