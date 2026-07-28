-- 推理开关升级为推理等级：off / low / medium / high。
-- 旧的 thinkingEnabled=true 迁移为 medium（与升级前开启思考时的 OpenAI effort 一致），false 迁移为 off。

-- AlterTable
ALTER TABLE "UserLlmConfig" ADD COLUMN "reasoningEffort" TEXT NOT NULL DEFAULT 'off';

-- DataMigration
UPDATE "UserLlmConfig" SET "reasoningEffort" = 'medium' WHERE "thinkingEnabled" = true;

-- AlterTable
ALTER TABLE "UserLlmConfig" DROP COLUMN "thinkingEnabled";
