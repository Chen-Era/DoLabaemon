-- CreateEnum
CREATE TYPE "RuleMatcherType" AS ENUM ('TAG_ANY', 'NAME_ANY', 'ANTIBODY_TARGET_ANY', 'PRIMER_TARGET_ANY', 'PRIMER_REFERENCE');

-- AlterTable
ALTER TABLE "ExperimentRule" ADD COLUMN     "matcherAntibodyRole" "AntibodyRole",
ADD COLUMN     "matcherType" "RuleMatcherType" NOT NULL DEFAULT 'NAME_ANY',
ADD COLUMN     "matcherValues" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Reagent" ADD COLUMN     "experimentTags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "PrimerMeta" (
    "id" TEXT NOT NULL,
    "reagentId" TEXT NOT NULL,
    "targetName" TEXT,
    "isReferenceGene" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PrimerMeta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PrimerMeta_reagentId_key" ON "PrimerMeta"("reagentId");

-- AddForeignKey
ALTER TABLE "PrimerMeta" ADD CONSTRAINT "PrimerMeta_reagentId_fkey" FOREIGN KEY ("reagentId") REFERENCES "Reagent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
