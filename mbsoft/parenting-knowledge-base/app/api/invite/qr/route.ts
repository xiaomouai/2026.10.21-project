import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/store";
import { normalizeInviteCode, renderQrSvg, renderQrPng, buildInviteUrl, resolveOrigin } from "@/lib/invite";

// 依赖会话/数据库，禁止构建期静态化（也避免构建期访问 SQLite）
export const dynamic = "force-dynamic";

/**
 * 邀请二维码图片
 * GET /api/invite/qr?code=ABC123[&format=svg|png][&download=1]
 * 二维码内容为邀请链接，可被任意扫码工具解析（微信扫一扫直接打开注册页）
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const code = normalizeInviteCode(sp.get("code"));
  if (!code) {
    return NextResponse.json({ error: "邀请码格式不正确" }, { status: 400 });
  }
  if (!db.getUserByInviteCode(code)) {
    return NextResponse.json({ error: "邀请码不存在" }, { status: 404 });
  }

  const origin = resolveOrigin(req.headers.get("host"), req.headers.get("x-forwarded-proto"));
  const url = buildInviteUrl(code, origin);
  const wantsPng = sp.get("format") === "png";
  const download = sp.get("download") === "1";

  if (wantsPng) {
    const png = await renderQrPng(url, 640);
    return new NextResponse(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600",
        ...(download
          ? { "Content-Disposition": `attachment; filename="invite-${code}.png"` }
          : {}),
      },
    });
  }

  const svg = await renderQrSvg(url, 640);
  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      ...(download
        ? { "Content-Disposition": `attachment; filename="invite-${code}.svg"` }
        : {}),
    },
  });
}
