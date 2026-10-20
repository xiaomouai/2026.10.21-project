import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/store";
import { verifyPassword, setSessionCookie } from "@/lib/auth";

// 依赖会话/数据库，禁止构建期静态化（也避免构建期访问 SQLite）
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { phone, password } = await req.json();
    const user = db.getUserByPhone(String(phone || ""));

    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: "手机号或密码错误" }, { status: 400 });
    }

    setSessionCookie(user.id);
    const { passwordHash, ...publicUser } = user;
    return NextResponse.json({ user: publicUser, message: "登录成功" });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "登录失败" }, { status: 500 });
  }
}
