import { readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

import { upsertRuntimeReagentKnowledgeEntry } from "../src/lib/knowledge/runtime-store";
import { prisma } from "../src/lib/prisma";
import { importHermesKnowledge } from "../src/lib/reagent-knowledge/hermes-import";

const DEFAULT_EXPORT_PATH = "integrations/hermes/output/knowledge.jsonl";

/**
 * Hermes 知识管家导出文件的解析顺序：
 *   --file <path> > 环境变量 HERMES_KNOWLEDGE_EXPORT_PATH > 默认 integrations/hermes/output/knowledge.jsonl
 * 相对路径一律相对当前工作目录（通常在仓库根目录运行）。
 */
function resolveExportPath(argv: string[]) {
  const fileFlagIndex = argv.indexOf("--file");
  const fromFlag = fileFlagIndex >= 0 ? argv[fileFlagIndex + 1] : undefined;
  if (fileFlagIndex >= 0 && (!fromFlag || fromFlag.startsWith("--"))) {
    throw new Error("--file 需要跟一个文件路径参数");
  }
  const raw = fromFlag ?? process.env.HERMES_KNOWLEDGE_EXPORT_PATH?.trim() ?? DEFAULT_EXPORT_PATH;
  return isAbsolute(raw) ? raw : resolve(process.cwd(), raw);
}

async function main() {
  const strict = process.argv.includes("--strict");
  const exportPath = resolveExportPath(process.argv.slice(2));

  let jsonl: string;
  try {
    jsonl = readFileSync(exportPath, "utf8");
  } catch (error) {
    console.error(`读取 Hermes 导出文件失败: ${exportPath}`);
    console.error(error instanceof Error ? error.message : String(error));
    console.error("可通过 --file <path> 或环境变量 HERMES_KNOWLEDGE_EXPORT_PATH 指定导出文件。");
    process.exitCode = 1;
    return;
  }

  const { imported, rejected } = importHermesKnowledge(jsonl);

  // upsertRuntimeReagentKnowledgeEntry 内部按 DEMO_MODE 分流：演示模式写 demo-store，
  // 否则走 @/lib/prisma 的 PrismaClient（@prisma/client 自动读取 .env 中的 DATABASE_URL）。
  for (const entry of imported) {
    await upsertRuntimeReagentKnowledgeEntry(entry);
  }

  for (const item of rejected) {
    console.error(`第 ${item.line} 行被拒绝: ${item.error}`);
  }
  console.log(`Hermes 知识同步完成：导入 ${imported.length} 条，拒绝 ${rejected.length} 条（来源：${exportPath}）`);

  if (strict && rejected.length > 0) {
    console.error("--strict 模式：存在被拒绝的行，退出码置为 1。");
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
