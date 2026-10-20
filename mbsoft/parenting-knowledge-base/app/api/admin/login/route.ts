import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/store";
import { setSessionCookie, verifyPassword } from "@/lib/auth";

// 依赖会话/数据库，禁止构建期静态化（也避免构建期访问 SQLite）
export const dynamic = "force-dynamic";

// 后台登录：与前台共用账号体系，但只放行 role = admin
export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "请输入邮箱和密码" }, { status: 400 });
    }

    const user = db.getUserByEmail(String(email).trim().toLowerCase()) || db.getUserByEmail(String(email).trim());
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: "邮箱或密码错误" }, { status: 401 });
    }
    if (user.role !== "admin") {
      return NextResponse.json({ error: "该账号无管理员权限" }, { status: 403 });
    }

    setSessionCookie(user.id);
    return NextResponse.json({
      ok: true,
      user: { id: user.id, email: user.email, nickname: user.nickname, role: user.role },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "登录失败" }, { status: 500 });
  }
}
