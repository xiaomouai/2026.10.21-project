import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/store";
import { getCurrentUser } from "@/lib/auth";
import { mdToHtml } from "@/lib/markdown";
import { canViewTopic, getAccessTier, requiredTier, tierLabel } from "@/lib/access";
import ForumSection from "@/components/ForumSection";

export const dynamic = "force-dynamic";

export default function TopicDetail({ params }: { params: { slug: string } }) {
  const user = getCurrentUser();
  const topic = db.getTopicBySlug(params.slug);
  if (!topic) notFound();

  db.incrementViews(params.slug);

  const tier = getAccessTier(user);
  const canRead = canViewTopic(user, topic);
  const required = requiredTier(topic);
  const posts = db.getPostsByTopic(topic.id);

  const related = db
    .getAllTopics()
    .filter((t) => t.category === topic.category && t.id !== topic.id)
    .slice(0, 3);

  return (
    <div className="detail-grid">
      {/* 主内容 */}
      <div>
        <Link href="/topics" className="hint">← 返回教程列表</Link>
        <div className="article" style={{ marginTop: 12 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
            <span className={`tag ${topic.isPremium ? "tag-premium" : "tag-free"}`}>
              {topic.isPremium ? "💎 付费教程" : "免费教程"}
            </span>
            <span className="tag">{topic.category}</span>
            <span className="muted" style={{ fontSize: 13 }}>👁 {topic.views} 次阅读</span>
            {!canRead && (
              <span className="tag" style={{ background: "#fee2e2", color: "#991b1b", borderColor: "#fecaca" }}>
                🔒 需{tierLabel(required)}
              </span>
            )}
          </div>

          {canRead ? (
            <div dangerouslySetInnerHTML={{ __html: mdToHtml(topic.content) }} />
          ) : (
            <>
              <h1>{topic.title}</h1>
              <p className="muted">{topic.excerpt}</p>
              <div className="alert alert-warn" style={{ marginTop: 20 }}>
                🔒 该内容为 <b>{tierLabel(required)}</b> 专享。
                {tier === "free"
                  ? "你当前为免费用户，仅可试读摘要。"
                  : `你当前是${tierLabel(tier)}，需升级为${tierLabel(required)}后阅读。`}
                <br />
                请输入管理员发放的<b>授权卡密钥</b>激活会员，即可解锁全部内容。
              </div>
              <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Link href="/membership" className="btn btn-primary btn-sm">激活会员 / 输入密钥</Link>
                <Link href="/pricing" className="btn btn-outline btn-sm">查看会员权益</Link>
              </div>
              <div
                style={{
                  marginTop: 16, filter: "blur(6px)", opacity: 0.5, userSelect: "none",
                  maxHeight: 200, overflow: "hidden",
                }}
                dangerouslySetInnerHTML={{ __html: mdToHtml(topic.content) }}
              />
            </>
          )}
        </div>

        {/* 讨论区 */}
        <div style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 20 }}>💬 讨论区（{posts.length}）</h2>
          <ForumSection posts={posts} topicId={topic.id} currentUser={user} />
        </div>
      </div>

      {/* 侧边栏 */}
      <aside style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {!user && (
          <div className="card" style={{ background: "linear-gradient(135deg,#fce7f3,#ede9fe)" }}>
            <strong>👋 你好呀</strong>
            <p className="muted" style={{ fontSize: 13, margin: "8px 0" }}>
              登录后即可阅读全文、每日打卡赚积分、论坛互动。
            </p>
            <Link href="/membership" className="btn btn-primary btn-sm btn-block">
              登录 / 激活会员
            </Link>
          </div>
        )}

        {user && tier !== "full" && (
          <div className="card" style={{ background: "linear-gradient(135deg,#fef3c7,#ede9fe)" }}>
            <strong>🔓 你的会员状态：{tierLabel(tier)}</strong>
            <p className="muted" style={{ fontSize: 13, margin: "8px 0" }}>
              {tier === "free"
                ? "免费用户仅可试读。激活会员解锁全部教程。"
                : "月卡会员可看全部普内容，年卡会员可看全部内容。"}
            </p>
            <Link href="/membership" className="btn btn-primary btn-sm btn-block">激活 / 升级会员</Link>
          </div>
        )}

        <div className="card">
          <h3 style={{ fontSize: 15, margin: "0 0 10px" }}>📌 本节要点</h3>
          <ul style={{ paddingLeft: 18, margin: 0, fontSize: 14 }}>
            {topic.isPremium ? (
              <>
                <li>系统化分步骤讲解</li>
                <li>含可打印模板/对照表</li>
                <li>真实案例复盘</li>
                <li className="muted">需年卡会员解锁全文</li>
              </>
            ) : (
              <>
                <li>判断逻辑 + 可执行动作</li>
                <li>适合新手快速上手</li>
              </>
            )}
          </ul>
        </div>

        {related.length > 0 && (
          <div className="card">
            <h3 style={{ fontSize: 15, margin: "0 0 10px" }}>📚 同类教程</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {related.map((r) => (
                <Link key={r.id} href={`/topics/${r.slug}`} style={{ fontSize: 14 }}>
                  {r.title}
                </Link>
              ))}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
