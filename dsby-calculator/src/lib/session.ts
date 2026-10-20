// Cookie 名称与 JWT 密钥（集中管理）

export const USER_COOKIE = "user_session";
export const ADMIN_COOKIE = "admin_session";

// 会话有效期（秒）：默认 7 天
export const SESSION_TTL = 60 * 60 * 24 * 7;

export function getSecret(): string {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET is required in production");
  }
  return "dev-only-insecure-secret-change-me";
}
