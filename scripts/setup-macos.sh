#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

echo "==> [1/7] 检查 Docker CLI"
if ! command -v docker >/dev/null 2>&1; then
  echo "未检测到 docker 命令。请先安装 Docker Desktop: https://www.docker.com/products/docker-desktop/"
  exit 1
fi

echo "==> [2/7] 检查 Docker Daemon"
if ! docker info >/dev/null 2>&1; then
  echo "Docker Daemon 未运行。正在尝试启动 Docker Desktop..."
  open -a Docker || true
  echo "请等待 Docker Desktop 完全启动（菜单栏小鲸鱼稳定），再重新执行本脚本。"
  exit 1
fi

echo "==> [3/7] 启动 PostgreSQL 容器（若已存在则复用）"
if docker ps -a --format '{{.Names}}' | grep -q '^lab-postgres$'; then
  docker start lab-postgres >/dev/null
else
  docker run --name lab-postgres \
    -e POSTGRES_PASSWORD=postgres \
    -e POSTGRES_DB=lab_reagent \
    -p 5432:5432 \
    -d postgres:16 >/dev/null
fi

echo "==> [4/7] 准备环境变量"
if [ ! -f .env ]; then
  cp .env.example .env
  echo "已创建 .env，请按需填写 OPENAI_API_KEY。"
fi

echo "==> [5/7] 安装依赖"
npm install

echo "==> [6/7] 初始化数据库"
npx prisma generate
npx prisma migrate dev --name init
npm run db:seed

echo "==> [7/7] 完成"
echo "现在可运行: npm run dev"
