#!/usr/bin/env bash
# ============================================================================
# Hermes Agent 知识管家 · 服务器一键部署脚本
#
# 用法：
#   bash integrations/hermes/setup-server.sh
#
# 本脚本完成：
#   1. 检测并安装 Hermes Agent（官方安装器，见 NousResearch/hermes-agent 的 README）
#   2. 把本目录 skills/ 下的全部子目录（reagent-curator、reagent-parser、
#      experimental-record-writer 等）
#      拷贝到 Hermes 的 skills 目录（默认 ~/.hermes/skills/）
#   3. 创建知识导出目录（默认 integrations/hermes/output/）
#   4. 打印下一步手动指引（用 hermes cron/routine 机制定时产出 JSONL）
#
# 环境变量（可选）：
#   HERMES_HOME        Hermes 主目录（默认 ~/.hermes，与官方 HERMES_HOME 约定一致）
#   HERMES_OUTPUT_DIR  知识导出目录（默认取本脚本所在 integrations/hermes/output/）
#
# 说明：hermes cron 的具体参数以 `hermes cron create --help` 与官方文档为准；
# 本脚本只使用已从官方文档确认过的命令形态，并在末尾 echo 建议的 routine 文本。
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HERMES_HOME_DIR="${HERMES_HOME:-${HOME}/.hermes}"
SKILLS_SRC_DIR="${SCRIPT_DIR}/skills"
SKILLS_DST_DIR="${HERMES_HOME_DIR}/skills"
OUTPUT_DIR="${HERMES_OUTPUT_DIR:-${SCRIPT_DIR}/output}"
KNOWLEDGE_FILE="${OUTPUT_DIR}/knowledge.jsonl"

log() {
  printf '%s\n' "$*"
}

# ---------------------------------------------------------------------------
# 1. 安装 Hermes Agent（官方一键安装器）
# ---------------------------------------------------------------------------
if command -v hermes >/dev/null 2>&1; then
  log "[1/4] 已检测到 hermes CLI（$(command -v hermes)），跳过安装。"
else
  log "[1/4] 未检测到 hermes CLI，运行官方安装器（需要联网）..."
  curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash
  # 官方安装器通常把 hermes 链接到 ~/.local/bin；补进 PATH 以便后续检测
  export PATH="${HOME}/.local/bin:${PATH}"
  if ! command -v hermes >/dev/null 2>&1; then
    log "警告：安装后仍未在 PATH 中找到 hermes。请重开终端或把 hermes 所在目录加入 PATH，"
    log "      然后重新运行本脚本（skills 拷贝与目录创建幂等，可反复执行）。"
  fi
fi

# ---------------------------------------------------------------------------
# 2. 拷贝本项目 skills 到 Hermes skills 目录
#    （Hermes 源码 hermes_constants.get_skills_dir() = HERMES_HOME/skills，
#      自定义 skill 放进该目录即可被 hermes 加载）
# ---------------------------------------------------------------------------
log "[2/4] 安装 skills 到 ${SKILLS_DST_DIR} ..."
mkdir -p "${SKILLS_DST_DIR}"
installed_count=0
for skill_dir in "${SKILLS_SRC_DIR}"/*/; do
  # glob 未匹配时原样返回，守卫一下
  [ -d "${skill_dir}" ] || continue
  skill_name="$(basename "${skill_dir}")"
  cp -R "${skill_dir%/}" "${SKILLS_DST_DIR}/"
  log "      - 已安装 skill：${skill_name}"
  installed_count=$((installed_count + 1))
done
if [ "${installed_count}" -eq 0 ]; then
  log "错误：${SKILLS_SRC_DIR} 下没有找到任何 skill 子目录。" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# 3. 创建知识导出目录
# ---------------------------------------------------------------------------
log "[3/4] 创建知识导出目录 ${OUTPUT_DIR} ..."
mkdir -p "${OUTPUT_DIR}"
[ -f "${KNOWLEDGE_FILE}" ] || touch "${KNOWLEDGE_FILE}"

# ---------------------------------------------------------------------------
# 4. 打印下一步手动指引（建议的 routine 文本，供粘贴后按需修改）
# ---------------------------------------------------------------------------
log "[4/4] 部署完成。接下来请手动完成两件事："
cat <<EOF

────────────────────────────────────────────────────────────────
第 1 步 · 在 Hermes 上创建定时任务（routine），让 agent 定时运行
reagent-curator skill 并把结构化知识追加写入导出文件。

建议的 routine 命令（语法依据官方文档：hermes cron create 支持
cron 表达式或 'every 2h' 等自然间隔，--skills 预加载技能）：

  hermes cron create "0 3 * * *" \\
    "使用 reagent-curator 技能研究 3~5 种本实验室常用试剂（优先覆盖知识库尚无条目的品类）。严格按该技能的 JSONL 输出契约核对：枚举值、正则合法性、别名质量；通过核对的条目追加写入 ${KNOWLEDGE_FILE}（每行一个 JSON 对象，禁止 markdown 包裹）。研究后仍不确定的试剂宁可不产出。" \\
    --name "reagent-knowledge-curator" \\
    --skills "reagent-curator"

如需离线批量解析库存清单，可另行创建加载 reagent-parser 的任务；
其输出是中间产物，不会直接进入项目知识库。

提示：创建后可参考 hermes cron list / hermes cron run <ID> 验证；
具体参数与更多选项（如 --deliver）以 hermes cron create --help 和
官方文档为准：
  https://github.com/NousResearch/hermes-agent
  https://hermes-agent.nousresearch.com/docs
────────────────────────────────────────────────────────────────
第 2 步 · 把 knowledge.jsonl 送回项目主机并导入知识库。

例如用 rsync 同步（在项目主机上执行）：

  rsync -avz <服务器用户>@<服务器地址>:${KNOWLEDGE_FILE} \\
    integrations/hermes/output/knowledge.jsonl

然后在项目根目录运行导入（二者择一即可，也推荐配 cron 定时执行）：

  npm run knowledge:hermes-sync
  HERMES_KNOWLEDGE_EXPORT_PATH=/path/to/knowledge.jsonl npm run knowledge:hermes-sync -- --strict

更多背景与故障排查见 integrations/hermes/README.md 与
docs/hermes-integration.md。
────────────────────────────────────────────────────────────────

EOF
