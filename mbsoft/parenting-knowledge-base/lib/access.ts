// 会员层级与内容访问门禁（单一真源）
//
// 层级：
//   free  —— 未付费 / 会员过期：仅看摘要 + 模糊试读，正文锁定
//   basic —— 月卡：可看全部「普内容」（isPremium = false）
//   full  —— 年卡：可看全部内容（含付费 / 年专属，isPremium = true）
//
// 内容映射：isPremium = false → 需 basic 及以上；isPremium = true → 需 full

import { PublicUser, User, Topic, MembershipType } from "./types";

export type AccessTier = "free" | "basic" | "full";

const TIER_RANK: Record<AccessTier, number> = { free: 0, basic: 1, full: 2 };

// 取用户当前可访问层级（过期自动降级为 free）
export function getAccessTier(user?: PublicUser | null): AccessTier {
  if (!user) return "free";
  const until = user.membershipUntil ? new Date(user.membershipUntil).getTime() : 0;
  const active = until > Date.now();
  if (!active) return "free";
  if (user.membershipType === "year") return "full";
  if (user.membershipType === "month") return "basic";
  return "free";
}

// 会员状态详情（含剩余天数）
export function membershipStatus(user?: PublicUser | null): {
  type: MembershipType;
  tier: AccessTier;
  until?: string;
  daysLeft: number;
  active: boolean;
} {
  const tier = getAccessTier(user);
  const until = user?.membershipUntil;
  const active = tier !== "free";
  const daysLeft = until ? Math.max(0, Math.ceil((new Date(until).getTime() - Date.now()) / 86400000)) : 0;
  return {
    type: user?.membershipType || "none",
    tier,
    until,
    daysLeft,
    active,
  };
}

// 内容所需最低层级
export function requiredTier(topic: Topic): AccessTier {
  return topic.isPremium ? "full" : "basic";
}

// 当前层级是否满足内容所需层级
export function canAccess(tier: AccessTier, required: AccessTier): boolean {
  return TIER_RANK[tier] >= TIER_RANK[required];
}

// 用户能否查看该教程完整内容
export function canViewTopic(user: PublicUser | null | undefined, topic: Topic): boolean {
  return canAccess(getAccessTier(user), requiredTier(topic));
}

// 手机号脱敏
export function maskPhone(phone: string): string {
  if (!phone || phone.length < 7) return phone || "—";
  return phone.slice(0, 3) + "****" + phone.slice(7);
}

// 层级中文标签
export function tierLabel(tier: AccessTier): string {
  return tier === "full" ? "年卡会员" : tier === "basic" ? "月卡会员" : "免费用户";
}

// 会员档位中文标签
export function membershipLabel(type: MembershipType): string {
  return type === "year" ? "年度会员" : type === "month" ? "月度会员" : "未开通会员";
}

// AI 助手免费额度：年度会员（full）不限次，其他用户（含月卡）终身 1 次体验。
// 管理员不限次，便于运营自测。
export const AI_FREE_TRIALS = 1;

export type ChatAccess = {
  tier: AccessTier;
  unlimited: boolean; // 年卡会员 / 管理员
  used: number; // 已消耗次数
  remaining: number | null; // null = 不限次
  allowed: boolean;
};

// 聊天权限判定（唯一真源：API 路由与前端共用）
export function getChatAccess(user?: PublicUser | User | null): ChatAccess {
  const tier = getAccessTier(user as PublicUser | null | undefined);
  const used = Math.max(0, Number((user as any)?.aiUsed || 0));
  const unlimited = tier === "full" || (user as any)?.role === "admin";
  const remaining = unlimited ? null : Math.max(0, AI_FREE_TRIALS - used);
  return {
    tier,
    unlimited,
    used,
    remaining,
    allowed: unlimited || used < AI_FREE_TRIALS,
  };
}

// 兑换授权卡后的到期时间（月 +30 天，年 +365 天）
export function membershipUntil(tier: "month" | "year"): string {
  const days = tier === "year" ? 365 : 30;
  return new Date(Date.now() + days * 86400000).toISOString();
}
