import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "./lib/jwt";
import { USER_COOKIE, ADMIN_COOKIE } from "./lib/session";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 后台：放行登录页，其余需管理员会话
  if (pathname.startsWith("/admin")) {
    if (pathname === "/admin/login") return NextResponse.next();
    const token = req.cookies.get(ADMIN_COOKIE)?.value;
    const p = token ? await verifySession(token) : null;
    if (!p || p.role !== "admin") {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // 前台首页：需用户会话
  if (pathname === "/") {
    const token = req.cookies.get(USER_COOKIE)?.value;
    const p = token ? await verifySession(token) : null;
    if (!p || p.role !== "user") {
      const url = req.nextUrl.clone();
      url.pathname = "/auth";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/admin/:path*"],
};
