-- AlterTable
ALTER TABLE "ExperimentTechnique"
    ADD COLUMN "curationWarnings" TEXT[] DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN "formalPublication" BOOLEAN NOT NULL DEFAULT false;
