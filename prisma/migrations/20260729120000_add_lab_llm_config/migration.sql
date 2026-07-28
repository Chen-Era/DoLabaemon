-- Per-laboratory credentials are encrypted by the application before they
-- reach this column. The labId unique constraint is the tenant boundary for
-- the shared-model configuration.
CREATE TABLE "LabLlmConfig" (
    "id" TEXT NOT NULL,
    "labId" TEXT NOT NULL,
    "encryptedOpenaiApiKey" TEXT NOT NULL,
    "openaiBaseUrl" TEXT,
    "openaiModel" TEXT NOT NULL,
    "openaiVisionModel" TEXT,
    "reasoningEffort" TEXT NOT NULL DEFAULT 'off',
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LabLlmConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LabLlmConfig_labId_key" ON "LabLlmConfig"("labId");

ALTER TABLE "LabLlmConfig"
ADD CONSTRAINT "LabLlmConfig_labId_fkey"
FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE CASCADE ON UPDATE CASCADE;
