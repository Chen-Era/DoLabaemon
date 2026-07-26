-- CreateEnum
CREATE TYPE "JoinRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "LabJoinRequest" (
    "id" TEXT NOT NULL,
    "labId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT,
    "status" "JoinRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewerId" TEXT,

    CONSTRAINT "LabJoinRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LabJoinRequest_labId_status_idx" ON "LabJoinRequest"("labId", "status");

-- CreateIndex
CREATE INDEX "LabJoinRequest_userId_status_idx" ON "LabJoinRequest"("userId", "status");

-- AddForeignKey
ALTER TABLE "LabJoinRequest" ADD CONSTRAINT "LabJoinRequest_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabJoinRequest" ADD CONSTRAINT "LabJoinRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
