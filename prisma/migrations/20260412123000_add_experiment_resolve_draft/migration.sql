-- CreateTable
CREATE TABLE "ExperimentResolveDraft" (
    "id" TEXT NOT NULL,
    "labId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rawInput" JSONB NOT NULL,
    "resolvedOutput" JSONB NOT NULL,
    "resolutionSource" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "warnings" TEXT[],
    "isConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExperimentResolveDraft_pkey" PRIMARY KEY ("id")
);
