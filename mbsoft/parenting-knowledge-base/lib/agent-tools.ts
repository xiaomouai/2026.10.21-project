import { db } from "./store";
import { scoreTopics, pickDaily } from "./recommend";
import { readSiteSettings } from "./admin";
import { PublicUser, ChildProfile } from "./types";
import { retrieve } from "./agent-memory";

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function emptyProfile(): ChildProfile {
  return { ageBand: "", pains: [], feeding: undefined, goal: undefined, updatedAt: "" };
}

function rid(prefix: string) {
  return prefix + Math.random().toString(36).slice(2, 10);
}

// OpenAI 兼容的工具定义（供 function calling 使用）
export const TOOLS = [
  {
    type: "function",
    function: {
      name: "search_kb",
      description: "在育儿知识库中检索与某个问题相关的教程/文章，返回标题、摘要与链接。当用户追问具体知识点时使用。",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "检索关键词或问题" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "recommend_today",
      description: "获取今日为宝宝推荐的育儿一篇教程。",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "log_checkin",
      description: "为用户执行今日打卡并获得积分。当用户表达要打卡时使用。",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "post_question",
      description: "把用户的问题发布到妈妈论坛求助，并奖励积分。",
      parameters: {
        type: "object",
        properties: { content: { type: "string", description: "要发布到论坛的问题内容" } },
        required: ["content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_profile",
      description: "读取当前用户宝宝的档案（月龄、困扰、喂养、目标）。",
      parameters: { type: "object", properties: {} },
    },
  },
];

// 执行工具调用，返回给模型阅读的文本结果。所有操作都带 userId 作用域，绝不跨用户。
export async function executeTool(name: string, args: any, user: PublicUser): Promise<string> {
  args = args || {};
  switch (name) {
    case "search_kb": {
      const q = String(args.query || "");
      const txt = retrieve(user, q, 5);
      return txt ? "知识库检索结果：\n" + txt : "未检索到相关内容。";
    }
    case "recommend_today": {
      const topics = db.getAllTopics();
      const profile = (user.childProfile as ChildProfile) || emptyProfile();
      const scored = scoreTopics(topics, profile);
      const day = Math.floor(Date.now() / 86400000);
      const pick = pickDaily(scored, day);
      return pick
        ? `今日推荐：《${pick.topic.title}》(/topics/${pick.topic.slug})：${pick.topic.excerpt}`
        : "暂无推荐内容。";
    }
    case "log_checkin": {
      const today = todayStr();
      const has = db.getCheckInsByUser(user.id).some((c) => c.date === today);
      if (has) return "今日已打卡，无需重复。";
      const base = readSiteSettings().checkInPoints;
      const yesterday = new Date(Date.now() - 86400000);
      const yStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(
        yesterday.getDate()
      ).padStart(2, "0")}`;
      const checks = db.getCheckInsByUser(user.id);
      const hasYesterday = checks.some((c) => c.date === yStr);
      const streak = hasYesterday
        ? checks.filter((c) => c.date >= yStr).length + 1
        : 1;
      const pointsEarned = base + Math.min(streak, 5);
      db.createCheckIn({ id: rid("c-"), userId: user.id, date: today, pointsEarned });
      db.updateUser(user.id, { points: user.points + pointsEarned });
      return `打卡成功，获得 ${pointsEarned} 积分（连续第 ${streak} 天）。`;
    }
    case "post_question": {
      const content = String(args.content || "").trim();
      if (!content) return "内容为空，未发布。";
      db.createPost({
        id: rid("p-"),
        userId: user.id,
        nickname: user.nickname,
        content,
        createdAt: new Date().toISOString(),
        likes: 0,
        likedBy: [],
      });
      const reward = readSiteSettings().postPoints;
      db.updateUser(user.id, { points: user.points + reward });
      return `已将问题发布到论坛，奖励 ${reward} 积分。`;
    }
    case "get_profile": {
      const p = user.childProfile;
      return p ? JSON.stringify(p) : "用户尚未填写宝宝档案。";
    }
    default:
      return "未知工具。";
  }
}
