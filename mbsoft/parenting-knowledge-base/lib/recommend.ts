import { Topic, ChildProfile } from "./types";

// ---------- 调研选项（SurveyModal 与 API 校验共用） ----------

export const AGE_BANDS = ["0-3月", "4-6月", "7-9月", "10-12月", "12月以上"] as const;
export const AGE_LABELS: Record<string, string> = {
  "0-3月": "0-3个月",
  "4-6月": "4-6个月",
  "7-9月": "7-9个月",
  "10-12月": "10-12个月",
  "12月以上": "1岁以上",
};
export const PAIN_OPTIONS = [
  "夜醒频繁",
  "抱睡落地醒",
  "夜奶频繁",
  "小睡短",
  "入睡困难",
  "作息混乱",
] as const;
export const FEEDING_OPTIONS = ["母乳", "配方奶", "混合喂养"] as const;
export const GOAL_OPTIONS = ["减少夜醒", "戒夜奶", "改善小睡", "自主入睡", "建立作息"] as const;

// ---------- 教程标签推导 ----------

// 痛点标签：分类/标题/摘要中出现的关键词 → 标签
const PAIN_RULES: Record<string, string[]> = {
  夜醒频繁: ["夜醒"],
  抱睡落地醒: ["落地醒", "抱睡"],
  夜奶频繁: ["夜奶", "戒夜奶"],
  小睡短: ["小睡", "接觉", "清醒"],
  入睡困难: ["入睡", "放床", "哄睡", "自主入睡"],
  作息混乱: ["作息", "醒睡窗", "清醒窗", "规律"],
};

// 期望目标 → 对应痛点标签（目标额外加权）
const GOAL_TO_PAIN: Record<string, string> = {
  减少夜醒: "夜醒频繁",
  戒夜奶: "夜奶频繁",
  改善小睡: "小睡短",
  自主入睡: "入睡困难",
  建立作息: "作息混乱",
};

// 喂养方式 → 内容关键词（命中 +1，用于夜奶等内容的精细化匹配）
const FEEDING_WORDS: Record<string, string[]> = {
  母乳: ["母乳"],
  配方奶: ["配方", "奶粉"],
  混合喂养: [],
};

// 从标题/摘要提取月龄数字 → 月龄段标签（如 "3·5·7月龄" → 3,5,7）
function extractAgeBands(text: string): string[] {
  const bands = new Set<string>();
  const matches = text.matchAll(/([\d·．.\s]+)月龄/g);
  for (const m of matches) {
    const nums = m[1].match(/\d+/g) || [];
    for (const n of nums) {
      const month = parseInt(n, 10);
      if (isNaN(month)) continue;
      if (month <= 3) bands.add("0-3月");
      else if (month <= 6) bands.add("4-6月");
      else if (month <= 9) bands.add("7-9月");
      else if (month <= 12) bands.add("10-12月");
      else bands.add("12月以上");
    }
  }
  if (/1\s*岁|[1-9]\d+\s*个月/.test(text)) bands.add("12月以上");
  return [...bands];
}

// 教程 → 标签集合（痛点 + 月龄；月龄为空表示全月龄通用）
export function topicTags(t: Topic): { pains: string[]; ages: string[] } {
  const text = `${t.title} ${t.category} ${t.excerpt}`;
  const pains: string[] = [];
  for (const [tag, words] of Object.entries(PAIN_RULES)) {
    if (words.some((w) => text.includes(w))) pains.push(tag);
  }
  return { pains, ages: extractAgeBands(text) };
}

// ---------- 打分排序 ----------

export type ScoredTopic = {
  topic: Topic;
  score: number;
  reasons: string[]; // 推荐理由（如"针对：落地醒"）
};

export type ScoreOptions = {
  streak?: number; // 连续打卡天数：>=3 推进阶内容，<3 推免费基础内容
};

export function scoreTopics(
  topics: Topic[],
  profile: ChildProfile,
  opts?: ScoreOptions
): ScoredTopic[] {
  const goalPain = profile.goal ? GOAL_TO_PAIN[profile.goal] : undefined;

  return topics
    .map((t) => {
      const text = `${t.title} ${t.category} ${t.excerpt}`;
      const { pains: tp, ages } = topicTags(t);
      let score = 0;
      const reasons: string[] = [];

      // 痛点命中（核心权重）
      for (const p of profile.pains) {
        if (tp.includes(p)) {
          score += 3;
          if (reasons.length < 2) reasons.push(p);
        }
      }
      // 目标对应痛点额外加权
      if (goalPain && tp.includes(goalPain)) score += 2;
      // 月龄匹配：明确命中 +2；全月龄通用 +1；月龄不符 +0（不强制过滤）
      if (ages.length === 0) score += 1;
      else if (ages.includes(profile.ageBand)) {
        score += 2;
        if (!reasons.length) reasons.push(`${AGE_LABELS[profile.ageBand]}宝宝适用`);
      }
      // 喂养方式命中内容关键词 +1（如夜奶内容区分母乳/奶粉）
      if (profile.feeding) {
        const words = FEEDING_WORDS[profile.feeding];
        if (words?.some((w) => text.includes(w))) score += 1;
      }
      // 打卡行为动态调权：坚持 3 天以上推进阶（含付费），新手推免费基础内容
      if (typeof opts?.streak === "number") {
        if (opts.streak >= 3 && t.isPremium) score += 1;
        if (opts.streak < 3 && !t.isPremium) score += 1;
      }

      // 用浏览量做同分微调，让热门内容靠前
      return { topic: t, score: score * 100 + Math.min(t.views, 99), reasons };
    })
    .sort((a, b) => b.score - a.score);
}

// ---------- 打卡连击计算 ----------

// 从今天往回数连续打卡天数（与打卡页展示口径一致）
export function computeStreak(checkIns: { date: string }[]): number {
  const dates = new Set(checkIns.map((c) => c.date));
  let streak = 0;
  const cur = new Date();
  for (;;) {
    const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`;
    if (!dates.has(key)) break;
    streak++;
    cur.setDate(cur.getDate() - 1);
  }
  return streak;
}

// ---------- 今日一篇 ----------

// 按日期轮换，从高分命中池里选一篇"今日推荐"（每天不同，同一天内稳定）
export function pickDaily(
  scored: ScoredTopic[],
  epochDay: number
): ScoredTopic | undefined {
  const pool = scored.filter((s) => s.score > 0);
  const candidates = pool.length > 0 ? pool : scored;
  if (candidates.length === 0) return undefined;
  return candidates[epochDay % Math.min(3, candidates.length)];
}
