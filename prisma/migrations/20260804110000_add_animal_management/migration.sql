-- CreateEnum
CREATE TYPE "AnimalSex" AS ENUM ('MALE', 'FEMALE', 'MIXED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "AnimalCageStatus" AS ENUM ('ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "AnimalMouseStatus" AS ENUM ('ACTIVE', 'LEFT');

-- CreateEnum
CREATE TYPE "AnimalOperationScope" AS ENUM ('MOUSE', 'CAGE', 'RACK', 'SYSTEM');

-- CreateTable
CREATE TABLE "AnimalRack" (
    "id" TEXT NOT NULL,
    "labId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rows" INTEGER NOT NULL DEFAULT 8,
    "columns" INTEGER NOT NULL DEFAULT 8,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnimalRack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnimalCage" (
    "id" TEXT NOT NULL,
    "rackId" TEXT NOT NULL,
    "rowIndex" INTEGER NOT NULL,
    "columnIndex" INTEGER NOT NULL,
    "activeSlotKey" TEXT,
    "status" "AnimalCageStatus" NOT NULL DEFAULT 'ACTIVE',
    "movedInAt" TIMESTAMP(3) NOT NULL,
    "initialAgeWeeks" DOUBLE PRECISION NOT NULL,
    "strain" TEXT,
    "sex" "AnimalSex" NOT NULL DEFAULT 'UNKNOWN',
    "genotype" TEXT,
    "note" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnimalCage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnimalMouse" (
    "id" TEXT NOT NULL,
    "labId" TEXT NOT NULL,
    "cageId" TEXT NOT NULL,
    "identifier" TEXT,
    "status" "AnimalMouseStatus" NOT NULL DEFAULT 'ACTIVE',
    "movedInAt" TIMESTAMP(3) NOT NULL,
    "movedOutAt" TIMESTAMP(3),
    "leaveReason" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnimalMouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnimalOperation" (
    "id" TEXT NOT NULL,
    "labId" TEXT NOT NULL,
    "mouseId" TEXT NOT NULL,
    "cageId" TEXT NOT NULL,
    "operationType" TEXT NOT NULL,
    "operationAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "sourceScope" "AnimalOperationScope" NOT NULL DEFAULT 'MOUSE',
    "batchId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnimalOperation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnimalRack_labId_updatedAt_idx" ON "AnimalRack"("labId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AnimalCage_activeSlotKey_key" ON "AnimalCage"("activeSlotKey");

-- CreateIndex
CREATE INDEX "AnimalCage_rackId_status_rowIndex_columnIndex_idx" ON "AnimalCage"("rackId", "status", "rowIndex", "columnIndex");

-- CreateIndex
CREATE INDEX "AnimalMouse_labId_status_cageId_idx" ON "AnimalMouse"("labId", "status", "cageId");

-- CreateIndex
CREATE INDEX "AnimalMouse_cageId_status_idx" ON "AnimalMouse"("cageId", "status");

-- CreateIndex
CREATE INDEX "AnimalOperation_mouseId_operationAt_idx" ON "AnimalOperation"("mouseId", "operationAt");

-- CreateIndex
CREATE INDEX "AnimalOperation_labId_batchId_idx" ON "AnimalOperation"("labId", "batchId");

-- CreateIndex
CREATE INDEX "AnimalOperation_cageId_operationAt_idx" ON "AnimalOperation"("cageId", "operationAt");

-- AddForeignKey
ALTER TABLE "AnimalRack" ADD CONSTRAINT "AnimalRack_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalCage" ADD CONSTRAINT "AnimalCage_rackId_fkey" FOREIGN KEY ("rackId") REFERENCES "AnimalRack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalMouse" ADD CONSTRAINT "AnimalMouse_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalMouse" ADD CONSTRAINT "AnimalMouse_cageId_fkey" FOREIGN KEY ("cageId") REFERENCES "AnimalCage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalOperation" ADD CONSTRAINT "AnimalOperation_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalOperation" ADD CONSTRAINT "AnimalOperation_mouseId_fkey" FOREIGN KEY ("mouseId") REFERENCES "AnimalMouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalOperation" ADD CONSTRAINT "AnimalOperation_cageId_fkey" FOREIGN KEY ("cageId") REFERENCES "AnimalCage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalOperation" ADD CONSTRAINT "AnimalOperation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
