import { db } from "./store";
import { scoreTopics, AGE_LABELS } from "./recommend";
import { PublicUser, ChildProfile } from "./types";
import { readLlmConfig } from "./admin";

// 把用户档案拼进系统提示，做到「千人千面」
export function buildSystemPrompt(user: PublicUser): string {
  const cfg = readLlmConfig();
  const base =
    cfg.systemPrompt ||
    "你是一位好宝宝育儿知识库的 AI 助手，回答需基于婴幼儿睡眠与喂养的好宝宝依据，不替代医生诊断。";

  const profile = user.childProfile;
  let personal: string;
  if (profile) {
    const age = profile.ageBand ? AGE_LABELS[profile.ageBand] || profile.ageBand : "未知";
    personal = `\n当前用户宝宝：${age}；当前困扰：${(profile.pains || []).join("、") || "未填写"}；喂养方式：${
      profile.feeding || "未填写"
    }；期望目标：${profile.goal || "未填写"}。`;
  } else {
    personal = "\n当前用户尚未填写宝宝档案，可引导其补全以获得更精准的建议。";
  }

  return (
    base +
    personal +
    "\n回答需基于知识库资料，并尽量给出对应文章链接（/topics/<slug>）；不替代儿科医生诊断，遇到紧急或异常症状应建议就医。" +
    "\n可使用工具：检索知识库、获取今日推荐、帮用户打卡、把问题发到论坛、读取宝宝档案。"
  );
}

function emptyProfile(): ChildProfile {
  return { ageBand: "", pains: [], feeding: undefined, goal: undefined, updatedAt: "" };
}

// 知识库检索（RAG 召回）：复用 recommend.ts 的标签打分 + 用户问题关键词加权。
// 返回可直接拼进 prompt 的「参考资料」文本。
export function retrieve(user: PublicUser, query: string, top = 3): string {
  const topics = db.getAllTopics();
  if (!topics.length) return "";

  const profile = (user.childProfile as ChildProfile) || emptyProfile();
  const scored = scoreTopics(topics, profile);
  const q = query.trim().toLowerCase();

  const ranked = scored
    .map((s) => {
      let rel = s.score;
      if (q) {
        const text = `${s.topic.title} ${s.topic.excerpt} ${s.topic.content}`.toLowerCase();
        for (const w of q.split(/\s+/).filter(Boolean)) {
          if (text.includes(w)) rel += 2;
        }
      }
      return { topic: s.topic, rel };
    })
    .sort((a, b) => b.rel - a.rel);

  const topOnes = ranked.filter((s) => s.rel > 0).slice(0, top);
  if (!topOnes.length) return "";

  return topOnes
    .map((s, i) => `[${i + 1}] 《${s.topic.title}》(/topics/${s.topic.slug})：${s.topic.excerpt}`)
    .join("\n");
}
