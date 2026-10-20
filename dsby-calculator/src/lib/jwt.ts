// JWT 会话（仅依赖 jose，可在 Edge runtime / middleware 中使用）
import { SignJWT, jwtVerify } from "jose";
import { getSecret, SESSION_TTL } from "./session";

function getKey() {
  return new TextEncoder().encode(getSecret());
}

export type SessionPayload = { sub: string; role: "user" | "admin" };

export async function signSession(
  sub: string,
  role: "user" | "admin",
  ttl: number = SESSION_TTL
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return await new SignJWT({ role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(sub)
    .setIssuedAt(now)
    .setExpirationTime(now + ttl)
    .sign(getKey());
}

export async function verifySession(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getKey());
    const role = payload.role;
    if (role !== "user" && role !== "admin") return null;
    return { sub: String(payload.sub), role };
  } catch {
    return null;
  }
}
