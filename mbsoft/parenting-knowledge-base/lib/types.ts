// 全局类型定义

// 宝宝档案（注册后调研收集，用于个性化推荐）
export type ChildProfile = {
  ageBand: string; // 月龄段："0-3月" | "4-6月" | "7-9月" | "10-12月" | "12月以上"
  pains: string[]; // 困扰标签，最多 3 个
  feeding?: string; // 喂养方式：母乳 / 配方奶 / 混合喂养
  goal?: string; // 期望目标
  updatedAt: string;
};

export type UserRole = "user" | "admin";

// 会员档位：none=未付费/过期，month=月卡(普内容)，year=年卡(全部内容)
export type MembershipType = "none" | "month" | "year";

export type User = {
  id: string;
  phone: string; // 唯一登录标识（手机号）
  email?: string; // 兼容老数据，已不再用于登录
  nickname: string;
  passwordHash: string;
  points: number;
  createdAt: string;
  role: UserRole;
  inviteCode: string; // 本人邀请码（唯一，用于生成邀请链接/二维码）
  invitedBy?: string; // 邀请人的 userId（注册时通过邀请码带入）
  childProfile?: ChildProfile;
  membershipType: MembershipType;
  membershipUntil?: string; // ISO 时间，月卡/年卡到期时刻；none 时无
  // AI 助手已消耗次数（计费口径详见 lib/access.ts 的 getChatAccess）
  aiUsed?: number;
};

export type PublicUser = Omit<User, "passwordHash">;

// 授权卡（后台生成，用户兑换激活会员）
export type LicenseCardTier = "month" | "year";
export type LicenseCard = {
  id: string;
  code: string; // 可读密钥，如 KB1M-A1B2C3D4
  tier: LicenseCardTier;
  status: "unused" | "used";
  usedBy?: string;
  usedAt?: string;
  createdBy?: string;
  batch?: string; // 批次备注
  createdAt: string;
};

export type Topic = {
  id: string;
  slug: string;
  title: string;
  category: string;
  excerpt: string;
  content: string;
  isPremium: boolean;
  authorId: string;
  createdAt: string;
  views: number;
};

export type CheckIn = {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  pointsEarned: number;
};

export type Post = {
  id: string;
  topicId?: string;
  userId: string;
  nickname: string;
  title?: string;
  content: string;
  createdAt: string;
  likes: number;
  likedBy: string[];
  replyTo?: string; // 父帖 id（回复功能）
  replyToNickname?: string; // 父帖昵称（发帖时快照，免联查）
};

// 邀请记录（一次成功邀请一行，含双方奖励快照，便于后台统计与追溯）
export type Invite = {
  id: string;
  inviterId: string; // 邀请人
  inviteeId: string; // 被邀请注册的新用户
  code: string; // 使用的邀请码
  inviterPoints: number; // 邀请人获得积分
  inviteePoints: number; // 新用户额外获得积分
  createdAt: string;
};

export type Purchase = {
  id: string;
  userId: string;
  packageId: string;
  amount: number;
  createdAt: string;
};

export type Package = {
  id: string;
  name: string;
  description: string;
  price: number;
  features: string[];
  isPopular?: boolean;
};

// ---------- Agent 会话 ----------
export type Conversation = {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  createdAt: string;
};

// ---------- 后台配置 ----------

export type LlmProvider = "dashscope" | "openai" | "deepseek" | "moonshot" | "custom";

// 大模型配置（存 settings 表，键名 llm_config）
export type LlmConfig = {
  enabled: boolean;
  provider: LlmProvider;
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  updatedAt?: string;
  updatedBy?: string;
};

// 站点运营设置（存 settings 表，键名 site_settings）
export type SiteSettings = {
  siteName: string;
  announcement: string;
  registerBonus: number;
  checkInPoints: number;
  postPoints: number;
  inviteRewardInviter: number; // 邀请人奖励积分
  inviteRewardInvitee: number; // 被邀请人额外奖励积分
};
