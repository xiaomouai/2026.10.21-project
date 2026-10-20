import Link from "next/link";
import { db } from "@/lib/store";
import { getCurrentUser } from "@/lib/auth";
import { scoreTopics, AGE_LABELS, computeStreak } from "@/lib/recommend";
import { readSiteSettings } from "@/lib/admin";
import { getAccessTier, canViewTopic, requiredTier, tierLabel } from "@/lib/access";

// 依赖会话/数据库，禁止构建期静态化（也避免构建期访问 SQLite）
export const dynamic = "force-dynamic";

export default function HomePage() {
  const user = getCurrentUser();
  const tier = getAccessTier(user);
  const topics = db.getAllTopics();
  const freeTopics = topics.filter((t) => !t.isPremium).slice(0, 3);
  const totalPosts = db.getAllPosts().length;
  const totalUsers = db.getAllUsers().length;
  const site = readSiteSettings();
  const invitedCount = user ? db.getInvitesByInviter(user.id).length : 0;
  const recs =
    user?.childProfile
      ? scoreTopics(topics, user.childProfile, {
          streak: computeStreak(db.getCheckInsByUser(user.id)),
        }).slice(0, 3)
      : [];

  return (
    <>
      {/* 英雄区 */}
      <section className="hero">
        <div style={{ fontSize: 56 }}>🌙</div>
        <h1 className="hero-title">
          好宝宝育儿知识库
        </h1>
        <p className="hero-sub">
          3-8月龄宝宝睡眠排查 · 落地醒 · 抱睡降级 · 夜奶解耦
          <br />
          系统化工具体系，帮你一次找对原因，告别深夜崩溃
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/topics" className="btn btn-primary">📚 浏览教程</Link>
          <Link href="/membership" className="btn btn-outline">💎 激活会员</Link>
        </div>
        {!user && (
          <p className="hint" style={{ marginTop: 14 }}>
            🎁 注册即享 7 天免费体验 + 50 积分，无需立即付费
          </p>
        )}
      </section>

      {/* 数据统计 */}
      <section className="grid grid-3 keep-3 mt-6">
        <div className="card center">
          <div style={{ fontSize: 32 }}>📖</div>
          <div style={{ fontSize: 24, fontWeight: 800 }}>{topics.length}</div>
          <div className="muted">系统教程</div>
        </div>
        <div className="card center">
          <div style={{ fontSize: 32 }}>💬</div>
          <div style={{ fontSize: 24, fontWeight: 800 }}>{totalPosts}</div>
          <div className="muted">论坛讨论</div>
        </div>
        <div className="card center">
          <div style={{ fontSize: 32 }}>👩‍👧</div>
          <div style={{ fontSize: 24, fontWeight: 800 }}>{totalUsers}</div>
          <div className="muted">在册妈妈</div>
        </div>
      </section>

      {/* 邀请好友（登录后展示，双方都有奖励） */}
      {user && (
        <section className="mt-6">
          <Link href="/invite" className="invite-banner">
            <span className="invite-banner-icon" aria-hidden>🎁</span>
            <span className="invite-banner-body">
              <strong>邀请好友，双方都拿积分</strong>
              <span>
                好友注册成功，你得 {site.inviteRewardInviter} 分，好友额外得 {site.inviteRewardInvitee} 分
                {invitedCount > 0 && ` · 你已邀请 ${invitedCount} 位`}
              </span>
            </span>
            <span className="invite-banner-go">生成邀请码 →</span>
          </Link>
        </section>
      )}

      {/* 为你推荐（基于宝宝档案） */}
      {recs.length > 0 && user?.childProfile && (
        <section className="mt-6">
          <div className="row between" style={{ marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 20 }}>🎯 为你推荐</h2>
            <Link href="/topics" className="hint">查看全部 →</Link>
          </div>
          <p className="hint" style={{ marginTop: -6, marginBottom: 12 }}>
            根据{user.nickname}的宝宝档案（{AGE_LABELS[user.childProfile.ageBand]}
            {user.childProfile.pains.length > 0 && ` · ${user.childProfile.pains.join("、")}`}）生成
          </p>
          <div className="topic-list">
            {recs.map(({ topic: t, reasons }) => (
              <Link key={t.id} href={`/topics/${t.slug}`} className="topic-item">
                <div className="topic-icon">🎯</div>
                <div className="topic-body">
                  <p className="topic-title">{t.title}</p>
                  <p className="muted" style={{ fontSize: 13, margin: 0 }}>
                    {t.excerpt}
                  </p>
                  <div className="topic-meta" style={{ marginTop: 8 }}>
                    {reasons.map((r) => (
                      <span key={r} className="tag tag-rec">{r}</span>
                    ))}
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
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 免费教程预览 */}
      <section className="mt-6">
        <div className="row between" style={{ marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>免费教程抢先看</h2>
          <Link href="/topics" className="hint">查看全部 →</Link>
        </div>
        <div className="topic-list">
          {freeTopics.map((t) => (
            <Link key={t.id} href={`/topics/${t.slug}`} className="topic-item">
              <div className="topic-icon">📖</div>
              <div className="topic-body">
                <p className="topic-title">{t.title}</p>
                <p className="muted" style={{ fontSize: 13, margin: 0 }}>
                  {t.excerpt}
                </p>
                <div className="topic-meta" style={{ marginTop: 8 }}>
                  <span className="tag tag-free">免费</span>
                  <span>{t.category}</span>
                  <span>👁 {t.views}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 核心功能 */}
      <section className="mt-6">
        <h2 style={{ fontSize: 20, marginBottom: 12 }}>这里有什么</h2>
        <div className="grid grid-3">
          <div className="card center">
            <div style={{ fontSize: 32 }}>📚</div>
            <h3 style={{ margin: "8px 0", fontSize: 16 }}>系统教程</h3>
            <p className="muted" style={{ fontSize: 13, margin: 0 }}>
              按主题分类，从排查到落地，一步步跟做
            </p>
          </div>
          <div className="card center">
            <div style={{ fontSize: 32 }}>📅</div>
            <h3 style={{ margin: "8px 0", fontSize: 16 }}>每日打卡</h3>
            <p className="muted" style={{ fontSize: 13, margin: 0 }}>
              连续打卡额外奖励，养成记录习惯
            </p>
          </div>
          <div className="card center">
            <div style={{ fontSize: 32 }}>💬</div>
            <h3 style={{ margin: "8px 0", fontSize: 16 }}>妈妈论坛</h3>
            <p className="muted" style={{ fontSize: 13, margin: 0 }}>
              真实案例分享、互相支招、点赞互动
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
