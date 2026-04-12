-- CreateEnum
CREATE TYPE "LabRole" AS ENUM ('PI', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "ReagentCategory" AS ENUM ('ANTIBODY', 'BUFFER', 'KIT', 'PRIMER', 'CHEMICAL', 'CONSUMABLE', 'OTHER');

-- CreateEnum
CREATE TYPE "AntibodyRole" AS ENUM ('PRIMARY', 'SECONDARY');

-- CreateEnum
CREATE TYPE "RuleLevel" AS ENUM ('MIN_REQUIRED', 'RECOMMENDED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lab" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Lab_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabMember" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "labId" TEXT NOT NULL,
    "role" "LabRole" NOT NULL DEFAULT 'MEMBER',

    CONSTRAINT "LabMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "labId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "LabRole" NOT NULL DEFAULT 'MEMBER',
    "invitedById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reagent" (
    "id" TEXT NOT NULL,
    "labId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "catalogNo" TEXT NOT NULL,
    "vendor" TEXT,
    "category" "ReagentCategory" NOT NULL,
    "subCategory" TEXT,
    "storageCondition" TEXT,
    "expiryDate" TIMESTAMP(3),
    "quantity" DOUBLE PRECISION,
    "unit" TEXT,
    "arrivalDate" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reagent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AntibodyMeta" (
    "id" TEXT NOT NULL,
    "reagentId" TEXT NOT NULL,
    "role" "AntibodyRole" NOT NULL,
    "hostSpecies" TEXT,
    "targetSpecies" TEXT,
    "targetName" TEXT,

    CONSTRAINT "AntibodyMeta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperimentType" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameZh" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,

    CONSTRAINT "ExperimentType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchDirection" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameZh" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,

    CONSTRAINT "ResearchDirection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperimentRule" (
    "id" TEXT NOT NULL,
    "experimentTypeId" TEXT NOT NULL,
    "researchDirectionId" TEXT,
    "level" "RuleLevel" NOT NULL,
    "displayNameZh" TEXT NOT NULL,
    "displayNameEn" TEXT NOT NULL,
    "requiredKeywords" TEXT[],

    CONSTRAINT "ExperimentRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReagentParseDraft" (
    "id" TEXT NOT NULL,
    "labId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rawInput" JSONB NOT NULL,
    "parsedOutput" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION,
    "warnings" TEXT[],
    "isConfirmed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ReagentParseDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperimentCheckRun" (
    "id" TEXT NOT NULL,
    "labId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "experimentCode" TEXT NOT NULL,
    "directionCode" TEXT,
    "prerequisite" TEXT,
    "confidenceLabel" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "warnings" TEXT[],
    "compatibilityIssues" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExperimentCheckRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperimentCheckItem" (
    "id" TEXT NOT NULL,
    "checkRunId" TEXT NOT NULL,
    "level" "RuleLevel" NOT NULL,
    "displayName" TEXT NOT NULL,
    "isMissing" BOOLEAN NOT NULL,
    "matchedName" TEXT,

    CONSTRAINT "ExperimentCheckItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "LabMember_userId_labId_key" ON "LabMember"("userId", "labId");

-- CreateIndex
CREATE UNIQUE INDEX "Reagent_labId_catalogNo_key" ON "Reagent"("labId", "catalogNo");

-- CreateIndex
CREATE UNIQUE INDEX "AntibodyMeta_reagentId_key" ON "AntibodyMeta"("reagentId");

-- CreateIndex
CREATE UNIQUE INDEX "ExperimentType_code_key" ON "ExperimentType"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ResearchDirection_code_key" ON "ResearchDirection"("code");

-- AddForeignKey
ALTER TABLE "LabMember" ADD CONSTRAINT "LabMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabMember" ADD CONSTRAINT "LabMember_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reagent" ADD CONSTRAINT "Reagent_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AntibodyMeta" ADD CONSTRAINT "AntibodyMeta_reagentId_fkey" FOREIGN KEY ("reagentId") REFERENCES "Reagent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentRule" ADD CONSTRAINT "ExperimentRule_experimentTypeId_fkey" FOREIGN KEY ("experimentTypeId") REFERENCES "ExperimentType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentRule" ADD CONSTRAINT "ExperimentRule_researchDirectionId_fkey" FOREIGN KEY ("researchDirectionId") REFERENCES "ResearchDirection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentCheckRun" ADD CONSTRAINT "ExperimentCheckRun_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentCheckItem" ADD CONSTRAINT "ExperimentCheckItem_checkRunId_fkey" FOREIGN KEY ("checkRunId") REFERENCES "ExperimentCheckRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
