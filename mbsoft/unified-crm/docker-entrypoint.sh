#!/bin/sh
set -e

PRISMA_BIN=/app/node_modules/.bin/prisma
CONFIG=/app/packages/db/prisma.config.ts
SCHEMA=/app/packages/db/prisma/schema.postgres.prisma

# 优先用镜像里装好的 prisma，找不到再退回 npx（不联网下载）
if [ -x "$PRISMA_BIN" ]; then
  PRISMA="$PRISMA_BIN"
else
  PRISMA="npx --no-install prisma"
fi

echo "⏳ 等待 PostgreSQL 就绪（${DB_HOST:-db}:${DB_PORT:-5432}）..."
node /app/docker-wait.js

echo "📦 同步 PostgreSQL 数据库结构（prisma db push，幂等）..."
if ! $PRISMA db push --config "$CONFIG" --schema "$SCHEMA" --skip-generate; then
  echo ""
  echo "❌ 数据库结构同步失败：已停止启动，不会带着旧结构继续对外服务。"
  echo "   常见原因："
  echo "   1) DATABASE_URL 的账号/库名与 db 服务不一致"
  echo "   2) 本次变更需要删列或改字段类型，db push 默认拒绝破坏性变更"
  echo "   人工确认后（务必先 pg_dump 备份）可执行："
  echo "     docker compose exec app $PRISMA db push --config $CONFIG --schema $SCHEMA --accept-data-loss"
  exit 1
fi

echo "🚀 启动 Next.js Application"
exec node /app/apps/web/server.js
