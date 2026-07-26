-- CreateEnum
CREATE TYPE "TechniqueStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'PUBLISHED', 'DEPRECATED');

-- CreateEnum
CREATE TYPE "TechniqueSource" AS ENUM ('SYSTEM', 'CURATED', 'AI_DRAFT');

-- CreateEnum
CREATE TYPE "TechniqueDraftStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TechniqueRequirementKind" AS ENUM ('REAGENT', 'CONSUMABLE', 'INSTRUMENT', 'SAMPLE', 'CONTROL', 'SOFTWARE');

-- CreateEnum
CREATE TYPE "TechniqueRequirementLevel" AS ENUM ('REQUIRED', 'RECOMMENDED', 'CONDITIONAL');

-- CreateEnum
CREATE TYPE "TechniqueVerificationMode" AS ENUM ('AUTO_INVENTORY', 'MANUAL_CONFIRMATION');

-- Preserve the existing five-technique check history while adding identifiers
-- needed by the unified requirement model.
ALTER TABLE "ExperimentCheckRun"
    ADD COLUMN "profileCode" TEXT,
    ADD COLUMN "techniqueRevision" INTEGER,
    ADD COLUMN "confirmedRequirementIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "ExperimentCheckItem"
    ADD COLUMN "requirementId" TEXT,
    ADD COLUMN "requirementKind" TEXT,
    ADD COLUMN "requirementLevel" TEXT,
    ADD COLUMN "verificationMode" TEXT,
    ADD COLUMN "state" TEXT;

-- CreateTable
CREATE TABLE "ExperimentTechnique" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "status" "TechniqueStatus" NOT NULL,
    "source" "TechniqueSource" NOT NULL,
    "contentHash" TEXT NOT NULL,
    "isAbstract" BOOLEAN NOT NULL DEFAULT false,
    "parentCode" TEXT,
    "nameZh" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "categoryCode" TEXT NOT NULL,
    "subcategoryCode" TEXT NOT NULL,
    "principleZh" TEXT NOT NULL,
    "principleEn" TEXT NOT NULL,
    "scopeZh" TEXT NOT NULL,
    "scopeEn" TEXT NOT NULL,
    "sampleTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "inputTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "outputTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "readoutModes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "throughput" TEXT NOT NULL,
    "destructive" BOOLEAN NOT NULL DEFAULT false,
    "workflowStages" JSONB NOT NULL,
    "keyParameters" JSONB NOT NULL,
    "qcMetrics" JSONB NOT NULL,
    "limitations" JSONB NOT NULL,
    "troubleshooting" JSONB NOT NULL,
    "safety" JSONB NOT NULL,
    "ontologyMappings" JSONB NOT NULL,
    "ontologyUnmappedReason" JSONB,
    "reportingStandards" JSONB NOT NULL,
    "evidenceSourceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "claimEvidence" JSONB NOT NULL,
    "resolutionExamples" JSONB NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL,
    "nextReviewDue" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExperimentTechnique_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperimentTechniqueProfile" (
    "id" TEXT NOT NULL,
    "techniqueId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "description" JSONB NOT NULL,

    CONSTRAINT "ExperimentTechniqueProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechniqueRequirement" (
    "id" TEXT NOT NULL,
    "techniqueId" TEXT NOT NULL,
    "profileId" TEXT,
    "kind" "TechniqueRequirementKind" NOT NULL,
    "level" "TechniqueRequirementLevel" NOT NULL,
    "verificationMode" "TechniqueVerificationMode" NOT NULL,
    "labelZh" TEXT NOT NULL,
    "labelEn" TEXT NOT NULL,
    "capabilityTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "matcherValues" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "condition" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TechniqueRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceSource" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "authorityScope" TEXT NOT NULL,
    "canonicalUrl" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "versionUri" TEXT NOT NULL,
    "releaseDate" TEXT NOT NULL,
    "retrievedAt" TIMESTAMP(3) NOT NULL,
    "licenseId" TEXT NOT NULL,
    "licenseUrl" TEXT,
    "reuseMode" TEXT NOT NULL,
    "doi" TEXT,
    "pmid" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvidenceSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechniqueEvidenceBinding" (
    "id" TEXT NOT NULL,
    "techniqueId" TEXT NOT NULL,
    "evidenceSourceId" TEXT NOT NULL,
    "supportedFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "claimLocator" TEXT,

    CONSTRAINT "TechniqueEvidenceBinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperimentTechniqueRevision" (
    "id" TEXT NOT NULL,
    "techniqueId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,
    "changeSummary" TEXT NOT NULL,
    "restoredFromRevision" INTEGER,
    "labId" TEXT,
    "publishedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExperimentTechniqueRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperimentTechniqueDraft" (
    "id" TEXT NOT NULL,
    "labId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "baseCode" TEXT,
    "baseRevision" INTEGER,
    "status" "TechniqueDraftStatus" NOT NULL DEFAULT 'DRAFT',
    "source" "TechniqueSource" NOT NULL DEFAULT 'CURATED',
    "payload" JSONB NOT NULL,
    "reviewerId" TEXT,
    "reviewNote" TEXT NOT NULL DEFAULT '',
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExperimentTechniqueDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExperimentTechnique_code_key" ON "ExperimentTechnique"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ExperimentTechnique_slug_key" ON "ExperimentTechnique"("slug");

-- CreateIndex
CREATE INDEX "ExperimentTechnique_status_active_idx" ON "ExperimentTechnique"("status", "active");

-- CreateIndex
CREATE INDEX "ExperimentTechnique_categoryCode_subcategoryCode_idx" ON "ExperimentTechnique"("categoryCode", "subcategoryCode");

-- CreateIndex
CREATE INDEX "ExperimentTechnique_parentCode_idx" ON "ExperimentTechnique"("parentCode");

-- CreateIndex
CREATE UNIQUE INDEX "ExperimentTechniqueProfile_techniqueId_code_key" ON "ExperimentTechniqueProfile"("techniqueId", "code");

-- CreateIndex
CREATE INDEX "TechniqueRequirement_techniqueId_kind_level_idx" ON "TechniqueRequirement"("techniqueId", "kind", "level");

-- CreateIndex
CREATE INDEX "TechniqueRequirement_profileId_idx" ON "TechniqueRequirement"("profileId");

-- CreateIndex
CREATE INDEX "EvidenceSource_tier_sourceType_idx" ON "EvidenceSource"("tier", "sourceType");

-- CreateIndex
CREATE UNIQUE INDEX "TechniqueEvidenceBinding_techniqueId_evidenceSourceId_key" ON "TechniqueEvidenceBinding"("techniqueId", "evidenceSourceId");

-- CreateIndex
CREATE INDEX "TechniqueEvidenceBinding_evidenceSourceId_idx" ON "TechniqueEvidenceBinding"("evidenceSourceId");

-- CreateIndex
CREATE UNIQUE INDEX "ExperimentTechniqueRevision_techniqueId_revision_key" ON "ExperimentTechniqueRevision"("techniqueId", "revision");

-- CreateIndex
CREATE INDEX "ExperimentTechniqueRevision_labId_createdAt_idx" ON "ExperimentTechniqueRevision"("labId", "createdAt");

-- CreateIndex
CREATE INDEX "ExperimentTechniqueDraft_labId_status_updatedAt_idx" ON "ExperimentTechniqueDraft"("labId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "ExperimentTechniqueDraft_baseCode_idx" ON "ExperimentTechniqueDraft"("baseCode");

-- AddForeignKey
ALTER TABLE "ExperimentTechniqueProfile" ADD CONSTRAINT "ExperimentTechniqueProfile_techniqueId_fkey" FOREIGN KEY ("techniqueId") REFERENCES "ExperimentTechnique"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechniqueRequirement" ADD CONSTRAINT "TechniqueRequirement_techniqueId_fkey" FOREIGN KEY ("techniqueId") REFERENCES "ExperimentTechnique"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechniqueRequirement" ADD CONSTRAINT "TechniqueRequirement_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "ExperimentTechniqueProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechniqueEvidenceBinding" ADD CONSTRAINT "TechniqueEvidenceBinding_techniqueId_fkey" FOREIGN KEY ("techniqueId") REFERENCES "ExperimentTechnique"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechniqueEvidenceBinding" ADD CONSTRAINT "TechniqueEvidenceBinding_evidenceSourceId_fkey" FOREIGN KEY ("evidenceSourceId") REFERENCES "EvidenceSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentTechniqueRevision" ADD CONSTRAINT "ExperimentTechniqueRevision_techniqueId_fkey" FOREIGN KEY ("techniqueId") REFERENCES "ExperimentTechnique"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentTechniqueRevision" ADD CONSTRAINT "ExperimentTechniqueRevision_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentTechniqueRevision" ADD CONSTRAINT "ExperimentTechniqueRevision_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentTechniqueDraft" ADD CONSTRAINT "ExperimentTechniqueDraft_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentTechniqueDraft" ADD CONSTRAINT "ExperimentTechniqueDraft_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentTechniqueDraft" ADD CONSTRAINT "ExperimentTechniqueDraft_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
