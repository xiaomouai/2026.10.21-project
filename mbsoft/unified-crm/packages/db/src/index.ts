import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

/**
 * 运行时 PrismaClient 单例（惰性初始化）。
 *
 * 按 DATABASE_URL 协议自动选择 adapter：
 *   - postgresql://（或 postgresql:）→ @prisma/adapter-pg（生产 / Docker / 托管 PG）
 *   - 其它（缺省、file:）→ @prisma/adapter-better-sqlite3（本地 SQLite 开发）
 *
 * 同一份代码既能在本地 SQLite 直跑，也能在 Docker + PostgreSQL 上运行，
 * 切换只靠环境变量，无需改代码。
 *
 * 惰性初始化：首次访问 `prisma.x` 时才真正构造客户端。这样 `next build`
 * 在「收集页面数据」阶段导入本模块时不会触发数据库连接 / adapter 兼容性校验，
 * 避免构建期因缺少 DATABASE_URL 而失败。
 */

/**
 * dev.db 定位策略（仅 SQLite 路径使用）：
 * - 源码直跑（packages/db/src/index.ts）时，import.meta.url 指向本文件 → ../../prisma/dev.db；
 * - 被 Next 编译进 .next/ 后（dev/start/build workers），import.meta.url 不再可靠，
 *   改以 process.cwd()（= apps/web 或仓库根）反向定位 packages/db/prisma/dev.db。
 * 取第一个真实存在的候选；都缺时回退 cwd 候选（better-sqlite3 会自动建库）。
 */
function resolveDbFile(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(process.cwd(), "packages/db/prisma/dev.db"),
    path.resolve(process.cwd(), "../../packages/db/prisma/dev.db"),
    path.resolve(here, "../../prisma/dev.db"),
  ];
  return candidates.find((p) => fs.existsSync(p)) ?? candidates[1];
}

function createPrisma(): PrismaClient {
  const databaseUrl = process.env.DATABASE_URL ?? "";

  if (databaseUrl.startsWith("postgresql:")) {
    const adapter = new PrismaPg({ connectionString: databaseUrl });
    return new PrismaClient({ adapter });
  }

  const dbFile = resolveDbFile();
  const adapter = new PrismaBetterSqlite3({ url: `file:${dbFile}` });
  return new PrismaClient({ adapter });
}

// 惰性单例：首次访问才构造，且把方法绑定到真实实例（保证 this 正确）
let _prisma: PrismaClient | null = null;
function getPrisma(): PrismaClient {
  if (!_prisma) _prisma = createPrisma();
  return _prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrisma();
    const value = (client as unknown as Record<PropertyKey, unknown>)[prop];
    return typeof value === "function"
      ? (value as (...args: unknown[]) => unknown).bind(client)
      : value;
  },
});

export type { Prisma } from "@prisma/client";

export * from "./constants";
export * from "./config";
