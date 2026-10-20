import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
};

/** 读取当前会话（无会话返回 null） */
export async function getSession() {
  const h = await headers();
  return auth.api.getSession({ headers: h });
}

/** 读取当前会话用户；未登录跳转登录页 */
export async function requireUser(): Promise<SessionUser> {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  return {
    id: session.user.id,
    name: session.user.name || "",
    email: session.user.email || "",
    image: session.user.image,
  };
}

/** 校验会话用户（API 路由用，未登录返回 null 而非跳转） */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getSession();
  if (!session?.user) return null;
  return {
    id: session.user.id,
    name: session.user.name || "",
    email: session.user.email || "",
    image: session.user.image,
  };
}
