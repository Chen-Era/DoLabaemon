-- CreateTable
CREATE TABLE "ReagentKnowledgeEntry" (
    "id" TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "category" "ReagentCategory" NOT NULL,
    "subCategory" TEXT,
    "experimentTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "namePatterns" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "requiredKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "excludedKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "vendorHints" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "evidenceType" TEXT NOT NULL,
    "confidenceHint" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'SYSTEM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReagentKnowledgeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperimentKnowledgeEntry" (
    "id" TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "normalizedCode" TEXT NOT NULL,
    "descriptionZh" TEXT NOT NULL,
    "descriptionEn" TEXT NOT NULL,
    "supportedDirections" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "workflowStages" JSONB NOT NULL,
    "requiredReagentTemplates" JSONB NOT NULL,
    "recommendedReagentTemplates" JSONB NOT NULL,
    "evidenceKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "excludedKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "relatedExperimentTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "source" TEXT NOT NULL DEFAULT 'SYSTEM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExperimentKnowledgeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReagentKnowledgeEntry_canonicalName_idx" ON "ReagentKnowledgeEntry"("canonicalName");

-- CreateIndex
CREATE INDEX "ExperimentKnowledgeEntry_canonicalName_idx" ON "ExperimentKnowledgeEntry"("canonicalName");

-- CreateIndex
CREATE INDEX "ExperimentKnowledgeEntry_normalizedCode_idx" ON "ExperimentKnowledgeEntry"("normalizedCode");
