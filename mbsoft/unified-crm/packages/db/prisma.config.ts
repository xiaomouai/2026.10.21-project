import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Prisma 7 CLI 配置（仅用于 CLI：generate / migrate / seed / studio）。
 * 运行时 PrismaClient 由 @ucrm/db 内部统一创建（src/client.ts），不依赖本文件。
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // 本地默认 SQLite：packages/db/.env 中 DATABASE_URL="file:./prisma/dev.db"
    // 生产切换 PostgreSQL：改 .env 为 postgresql://... 并在 schema 切换 provider
    url: process.env.DATABASE_URL,
  },
});
