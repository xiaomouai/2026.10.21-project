import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/store";
import { adminGuard } from "@/lib/admin";
import { hashPassword } from "@/lib/auth";
import { UserRole } from "@/lib/types";

// 依赖会话/数据库，禁止构建期静态化（也避免构建期访问 SQLite）
export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

// 修改会员资料：昵称 / 积分 / 角色
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const g = adminGuard();
  if (g.kind === "err") return g.res;

  const target = db.getUserById(params.id);
  if (!target) return NextResponse.json({ error: "会员不存在" }, { status: 404 });

  const body = await req.json();
  const patch: { nickname?: string; points?: number; role?: UserRole } = {};

  if (typeof body.nickname === "string" && body.nickname.trim()) {
    patch.nickname = body.nickname.trim().slice(0, 24);
  }
  if (body.points !== undefined) {
    const n = Number(body.points);
    if (!Number.isFinite(n)) return NextResponse.json({ error: "积分必须是数字" }, { status: 400 });
    patch.points = Math.max(0, Math.round(n));
  }
  if (body.role !== undefined) {
    if (body.role !== "user" && body.role !== "admin") {
      return NextResponse.json({ error: "角色只能是 user 或 admin" }, { status: 400 });
    }
    // 保护：不能取消最后一个管理员
    if (target.role === "admin" && body.role === "user" && db.countAdmins() <= 1) {
      return NextResponse.json({ error: "系统至少需要保留一名管理员" }, { status: 400 });
    }
    patch.role = body.role;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "没有需要更新的字段" }, { status: 400 });
  }

  const updated = db.updateUser(params.id, patch);
  const { passwordHash, ...safe } = updated!;
  return NextResponse.json({ ok: true, user: safe, message: "已保存" });
}

// 重置会员密码
export async function POST(req: NextRequest, { params }: Ctx) {
  const g = adminGuard();
  if (g.kind === "err") return g.res;

  const target = db.getUserById(params.id);
  if (!target) return NextResponse.json({ error: "会员不存在" }, { status: 404 });

  const { password } = await req.json();
  const pwd = String(password ?? "").trim();
  if (pwd.length < 6) return NextResponse.json({ error: "密码至少 6 位" }, { status: 400 });

  db.updatePassword(params.id, hashPassword(pwd));
  return NextResponse.json({ ok: true, message: `已重置 ${target.nickname} 的登录密码` });
}

// 删除会员（连带清理打卡 / 帖子 / 订单）
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const g = adminGuard();
  if (g.kind === "err") return g.res;

  const target = db.getUserById(params.id);
  if (!target) return NextResponse.json({ error: "会员不存在" }, { status: 404 });

  if (target.id === g.user.id) {
    return NextResponse.json({ error: "不能删除当前登录的管理员账号" }, { status: 400 });
  }
  if (target.role === "admin" && db.countAdmins() <= 1) {
    return NextResponse.json({ error: "系统至少需要保留一名管理员" }, { status: 400 });
  }

  db.deleteUser(params.id);
  return NextResponse.json({ ok: true, message: `已删除会员 ${target.nickname}` });
}
