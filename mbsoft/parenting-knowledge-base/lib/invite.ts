// 邀请功能核心工具（服务端专用：依赖 qrcode，勿在客户端组件中引入）
import crypto from "node:crypto";
import QRCode from "qrcode";

// ---------- 邀请码 ----------
// 字符集刻意剔除 0/O/1/I/L 等易混字符，方便口头传播与手输
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const CODE_LENGTH = 6;

export const INVITE_CODE_RE = /^[A-Z0-9]{4,16}$/;

/** 生成一个新的邀请码（随机、不含易混字符） */
export function genInviteCode(): string {
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET[crypto.randomInt(0, CODE_ALPHABET.length)];
  }
  return out;
}

/** 规范化用户输入的邀请码：去空格、大写、非法则返回 null */
export function normalizeInviteCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.trim().toUpperCase();
  return INVITE_CODE_RE.test(code) ? code : null;
}

// ---------- 邀请链接 ----------
/**
 * 邀请链接指向首页并携带邀请码：
 * 落地后前端捕获 invite 参数 → 自动打开注册弹窗且预填邀请码（转化路径最短）
 */
export function buildInviteUrl(code: string, origin: string): string {
  return `${origin.replace(/\/+$/, "")}/?invite=${code}`;
}

/** 由请求头推导站点绝对地址（本地走 http，线上走 https），供生成邀请链接与二维码使用 */
export function resolveOrigin(host: string | null, proto: string | null): string {
  const h = (host || "localhost:3000").trim();
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)(:\d+)?$/i.test(h);
  const scheme = isLocal ? "http" : (proto || "").split(",")[0].trim() || "https";
  return `${scheme}://${h}`;
}

// ---------- 二维码渲染 ----------
const QR_COLORS = { dark: "#3b2b3b", light: "#ffffff" };

/** 生成 SVG 字符串（矢量为佳，嵌入页面清晰且体积极小） */
export async function renderQrSvg(text: string, width = 260): Promise<string> {
  return QRCode.toString(text, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    width,
    color: QR_COLORS,
  });
}

/** 生成 PNG Buffer（用于下载成图片便于在微信等 App 里转发） */
export async function renderQrPng(text: string, width = 640): Promise<Buffer> {
  return QRCode.toBuffer(text, {
    type: "png",
    errorCorrectionLevel: "M",
    margin: 2,
    width,
    color: QR_COLORS,
  });
}
