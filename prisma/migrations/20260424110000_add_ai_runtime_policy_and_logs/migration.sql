-- AlterTable
ALTER TABLE "UserLlmConfig"
ADD COLUMN     "enabledSkills" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "enabledMcpServers" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "selfCheckEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "autoLearnEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "LabAiPolicy" (
    "id" TEXT NOT NULL,
    "labId" TEXT NOT NULL,
    "allowAutoLearn" BOOLEAN NOT NULL DEFAULT false,
    "allowedRoles" "LabRole"[] DEFAULT ARRAY['PI']::"LabRole"[],
    "enabledKnowledgeDomains" TEXT[] DEFAULT ARRAY['REAGENT','EXPERIMENT']::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LabAiPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeMutationLog" (
    "id" TEXT NOT NULL,
    "labId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "flowType" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "entityKey" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "beforeData" JSONB,
    "afterData" JSONB,
    "evidenceSummary" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "modelName" TEXT,
    "rolledBackAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeMutationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LabAiPolicy_labId_key" ON "LabAiPolicy"("labId");

-- CreateIndex
CREATE INDEX "KnowledgeMutationLog_labId_createdAt_idx" ON "KnowledgeMutationLog"("labId", "createdAt");

-- CreateIndex
CREATE INDEX "KnowledgeMutationLog_userId_createdAt_idx" ON "KnowledgeMutationLog"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "LabAiPolicy" ADD CONSTRAINT "LabAiPolicy_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeMutationLog" ADD CONSTRAINT "KnowledgeMutationLog_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeMutationLog" ADD CONSTRAINT "KnowledgeMutationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
