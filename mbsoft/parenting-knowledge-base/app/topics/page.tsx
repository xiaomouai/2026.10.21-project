import Link from "next/link";
import { db } from "@/lib/store";
import { getCurrentUser } from "@/lib/auth";
import { scoreTopics, computeStreak } from "@/lib/recommend";
import { getAccessTier, canViewTopic, requiredTier, tierLabel } from "@/lib/access";

export const dynamic = "force-dynamic";

export default function TopicsPage({
  searchParams,
}: {
  searchParams: { q?: string; cat?: string };
}) {
  const user = getCurrentUser();
  const tier = getAccessTier(user);
  const q = searchParams.q || "";
  const cat = searchParams.cat || "";

  let topics = db.getAllTopics();
  if (q) topics = db.searchTopics(q);
  if (cat) topics = topics.filter((t) => t.category === cat);

  // 有宝宝档案时按匹配度排序（结合打卡连击动态调权），前 3 个高分命中打推荐角标
  const scored =
    user?.childProfile && !q && !cat
      ? scoreTopics(topics, user.childProfile, {
          streak: computeStreak(db.getCheckInsByUser(user.id)),
        })
      : null;
  if (scored) topics = scored.map((s) => s.topic);
  const topSlugs = new Set(
    (scored?.slice(0, 3) ?? []).filter((s) => s.score >= 300).map((s) => s.topic.slug)
  );

  const categories = Array.from(new Set(db.getAllTopics().map((t) => String(t.category))));

  function iconFor(category: string) {
    const map: Record<string, string> = {
      "夜醒排查": "🌙", "抱睡落地醒": "🤗", "作息作息": "⏰",
      "夜奶喂养": "🍼", "工具模板": "📋",
    };
    return map[category] || "📖";
  }

  return (
    <>
      <h1 style={{ fontSize: 24, marginTop: 18 }}>📚 教程知识库</h1>
      <p className="muted">
        系统化的睡眠排查教程。免费教程可直接阅读；普内容需月卡会员，全部内容（含付费）需年卡会员。
      </p>

      {/* 搜索 */}
      <form action="/topics" method="GET">
        <input
          className="search"
          name="q"
          placeholder="🔍 搜索关键词，如：落地醒、夜醒、抱睡、记录表..."
          defaultValue={q}
        />
      </form>

      {/* 分类 */}
      <div className="cats">
        <Link href="/topics" className={`cat-chip ${!cat ? "active" : ""}`}>
          全部
        </Link>
        {categories.map((c) => (
          <Link
            key={c}
            href={`/topics?cat=${encodeURIComponent(c)}`}
            className={`cat-chip ${cat === c ? "active" : ""}`}
          >
            {c}
          </Link>
        ))}
      </div>

      {/* 列表 */}
      <div className="topic-list">
        {topics.length === 0 ? (
          <div className="card center muted">没有找到匹配的教程 😢</div>
        ) : (
          topics.map((t) => (
            <Link key={t.id} href={`/topics/${t.slug}`} className="topic-item">
              <div className="topic-icon">{iconFor(t.category)}</div>
              <div className="topic-body">
                <p className="topic-title">{t.title}</p>
                <p className="muted" style={{ fontSize: 13, margin: 0 }}>{t.excerpt}</p>
                <div className="topic-meta" style={{ marginTop: 8 }}>
                  {topSlugs.has(t.slug) && <span className="tag tag-rec">🎯 为你推荐</span>}
                  {t.isPremium ? (
                    <span className="tag tag-premium">💎 付费</span>
                  ) : (
                    <span className="tag tag-free">免费</span>
                  )}
                  {!canViewTopic(user, t) && (
                    <span className="tag" style={{ background: "#fee2e2", color: "#991b1b", borderColor: "#fecaca" }}>
                      🔒 需{tierLabel(requiredTier(t))}
                    </span>
                  )}
                  <span>{t.category}</span>
                  <span>👁 {t.views}</span>
                  {canViewTopic(user, t) && <span>✓ 已解锁</span>}
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </>
  );
}
