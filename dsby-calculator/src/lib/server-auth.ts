// 服务端读取当前登录身份（仅用于 Server Component / Route Handler，勿在 middleware 或客户端使用）
import { cookies } from "next/headers";
import { verifySession } from "./jwt";
import { USER_COOKIE, ADMIN_COOKIE } from "./session";
import { getDb } from "./db";

export type CurrentUser = {
  id: number;
  username: string;
  email: string | null;
  expires_at: string;
  status: string;
  note: string | null;
};

export type CurrentAdmin = { id: number; username: string };

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = cookies().get(USER_COOKIE)?.value;
  if (!token) return null;
  const p = await verifySession(token);
  if (!p || p.role !== "user") return null;
  const db = getDb();
  const row = db
    .prepare(
      "SELECT id, username, email, expires_at, status, note FROM users WHERE id = ?"
    )
    .get(Number(p.sub)) as CurrentUser | undefined;
  return row ?? null;
}

export async function getCurrentAdmin(): Promise<CurrentAdmin | null> {
  const token = cookies().get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  const p = await verifySession(token);
  if (!p || p.role !== "admin") return null;
  const db = getDb();
  const row = db
    .prepare("SELECT id, username FROM admins WHERE id = ?")
    .get(Number(p.sub)) as CurrentAdmin | undefined;
  return row ?? null;
}
