import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@ucrm/db";

const authDatabaseProvider = process.env.DATABASE_URL?.startsWith("postgresql:")
  ? "postgresql"
  : "sqlite";

/**
 * better-auth 服务端实例（邮箱 + 密码）。
 * 用户数据表 User / Session / Account 见 @ucrm/db schema（[认证] 段落）。
 *
 * 多租户：用户登录后自行创建/加入 Organization（见 /onboarding 与 settings/members），
 * 业务数据一律携带 orgId，由页面/action 按组织过滤。首版为「组织内单租户上下文」，
 * 后续可扩展跨组织会话切换（active org cookie）。
 */
export const auth = betterAuth({
  // Prisma 7 生成的 client 需经 prismaAdapter 显式桥接（直连 Kysely 探测不识别）
  database: prismaAdapter(prisma, { provider: authDatabaseProvider }),
  secret: process.env.BETTER_AUTH_SECRET || "dev-only-secret-ucrm-local-0123456789abcdef",
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:81",
  trustedOrigins: [
    process.env.BETTER_AUTH_URL,
    "http://localhost:8081",
    "http://127.0.0.1:8081",
    "http://localhost:81",
  ].filter((origin): origin is string => Boolean(origin)),
  emailAndPassword: {
    enabled: true,
  },
  advanced: {
    cookiePrefix: "ucrm",
  },
});
