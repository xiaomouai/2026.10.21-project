import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { db } from "./store";
import { PublicUser } from "./types";

const SESSION_COOKIE = "kb_session";
const SECRET = "parenting-kb-secret-key"; // 演示用，生产应放环境变量

// 简易签名（演示用，非生产级加密）
function sign(value: string): string {
  // 使用简单编码 + 校验，避免额外依赖
  const b = Buffer.from(value + SECRET).toString("base64").slice(0, 16);
  return Buffer.from(value + "." + b).toString("base64url");
}

function verify(token: string): string | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString();
    const [value, sig] = decoded.split(".");
    if (!value || !sig) return null;
    const expected = Buffer.from(value + SECRET).toString("base64").slice(0, 16);
    return sig === expected ? value : null;
  } catch {
    return null;
  }
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

export function createSession(userId: string): string {
  return sign(userId);
}

export function setSessionCookie(userId: string) {
  const token = createSession(userId);
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7天
  });
}

export function clearSession() {
  cookies().delete(SESSION_COOKIE);
}

export function getCurrentUser(): PublicUser | null {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const userId = verify(token);
  if (!userId) return null;
  const user = db.getUserById(userId);
  if (!user) return null;
  const { passwordHash, ...publicUser } = user;
  return publicUser;
}

export function requireUser(): PublicUser {
  const user = getCurrentUser();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  return user;
}
