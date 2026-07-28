-- Upload provenance is a snapshot: the display name remains available even if
-- the associated user later changes their profile or is removed.
ALTER TABLE "Reagent"
    ADD COLUMN "uploadedById" TEXT,
    ADD COLUMN "uploadedByName" TEXT,
    ADD COLUMN "uploadedAt" TIMESTAMP(3);

-- Existing records predate this feature. Preserve their original creation time
-- and mark the uploader as unknown instead of assigning a misleading account.
UPDATE "Reagent"
SET
    "uploadedByName" = '历史记录（上传者未知）',
    "uploadedAt" = "createdAt"
WHERE "uploadedByName" IS NULL OR "uploadedAt" IS NULL;

ALTER TABLE "Reagent"
    ALTER COLUMN "uploadedByName" SET NOT NULL,
    ALTER COLUMN "uploadedAt" SET NOT NULL,
    ALTER COLUMN "uploadedAt" SET DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "Reagent_uploadedById_uploadedAt_idx" ON "Reagent"("uploadedById", "uploadedAt");

ALTER TABLE "Reagent"
    ADD CONSTRAINT "Reagent_uploadedById_fkey"
    FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
