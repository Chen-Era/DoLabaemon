-- AlterTable
ALTER TABLE "UserLlmConfig" ADD COLUMN "thinkingEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "knowledgeVerifySkipEnabled" BOOLEAN NOT NULL DEFAULT true;
