import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/store";
import { hashPassword, setSessionCookie } from "@/lib/auth";
import { User, SiteSettings, Invite } from "@/lib/types";
import { normalizeInviteCode } from "@/lib/invite";

// 依赖会话/数据库，禁止构建期静态化（也避免构建期访问 SQLite）
export const dynamic = "force-dynamic";

const PHONE_RE = /^1[3-9]\d{9}$/;

export async function POST(req: NextRequest) {
  try {
    const { phone, password, nickname, invite } = await req.json();

    if (!phone || !PHONE_RE.test(String(phone))) {
      return NextResponse.json({ error: "请输入有效的手机号" }, { status: 400 });
    }
    if (!password || password.length < 6) {
      return NextResponse.json({ error: "密码至少6位" }, { status: 400 });
    }
    if (db.getUserByPhone(String(phone))) {
      return NextResponse.json({ error: "该手机号已注册" }, { status: 400 });
    }

    const site = db.getSetting<Partial<SiteSettings>>("site_settings", {});
    const registerBonus = site.registerBonus ?? 50;
    const rewardInviter = site.inviteRewardInviter ?? 100;
    const rewardInvitee = site.inviteRewardInvitee ?? 30;

    // 邀请码解析（无效码不阻断注册）
    const code = normalizeInviteCode(invite);
    const inviter = code ? db.getUserByInviteCode(code) : undefined;
    const inviteApplied = !!inviter;
    const inviteeBonus = inviteApplied ? rewardInvitee : 0;

    const id = "u-" + Math.random().toString(36).slice(2, 9);
    const user: User = {
      id,
      phone: String(phone),
      nickname: nickname?.trim() || `用户${String(phone).slice(7)}`,
      passwordHash: hashPassword(password),
      points: registerBonus + inviteeBonus,
      createdAt: new Date().toISOString(),
      role: "user",
      inviteCode: "",
      invitedBy: inviteApplied ? inviter!.id : undefined,
      membershipType: "none",
    };
    db.createUser(user);

    if (inviteApplied && inviter) {
      db.addPoints(inviter.id, rewardInviter);
      const record: Invite = {
        id: "inv-" + Math.random().toString(36).slice(2, 9),
        inviterId: inviter.id,
        inviteeId: id,
        code: code!,
        inviterPoints: rewardInviter,
        inviteePoints: rewardInvitee,
        createdAt: new Date().toISOString(),
      };
      db.createInvite(record);
    }

    const saved = db.getUserById(id)!;
    setSessionCookie(id);

    const { passwordHash, ...publicUser } = saved;
    const parts = [`注册成功，赠送${registerBonus}积分`];
    if (inviteApplied) parts.push(`邀请奖励 +${inviteeBonus}积分`);
    else if (code) parts.push("邀请码无效，未获得邀请奖励");

    return NextResponse.json({
      user: publicUser,
      inviteApplied,
      inviterNickname: inviteApplied ? inviter!.nickname : undefined,
      message: parts.join("，"),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "注册失败" }, { status: 500 });
  }
}
