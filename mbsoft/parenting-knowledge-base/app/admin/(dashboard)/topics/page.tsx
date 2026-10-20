import { db } from "@/lib/store";
import TopicManager from "@/components/admin/TopicManager";

export const dynamic = "force-dynamic";

export default function AdminTopicsPage() {
  const topics = db.getAllTopics();
  const views = topics.reduce((s, t) => s + t.views, 0);
  const categories = new Set(topics.map((t) => t.category)).size;
  const premium = topics.filter((t) => t.isPremium).length;

  return (
    <div className="a-stack">
      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-ico" aria-hidden>📚</span>
          <span className="stat-label">教程总数</span>
          <span className="stat-value">{topics.length}<small>篇</small></span>
          <span className="stat-delta">覆盖 {categories} 个分类</span>
        </div>
        <div className="stat-card">
          <span className="stat-ico" aria-hidden>💎</span>
          <span className="stat-label">付费教程</span>
          <span className="stat-value">{premium}<small>篇</small></span>
          <span className="stat-delta">免费 <b>{topics.length - premium}</b> 篇</span>
        </div>
        <div className="stat-card">
          <span className="stat-ico" aria-hidden>👀</span>
          <span className="stat-label">累计浏览量</span>
          <span className="stat-value">{views}<small>次</small></span>
          <span className="stat-delta">
            篇均 <b>{topics.length ? Math.round(views / topics.length) : 0}</b> 次
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-ico" aria-hidden>🆕</span>
          <span className="stat-label">最近更新</span>
          <span className="stat-value" style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.5 }}>
            {topics.length
              ? [...topics].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0].title.slice(0, 14)
              : "—"}
          </span>
          <span className="stat-delta">内容运营建议每周至少新增 1 篇</span>
        </div>
      </div>

      <TopicManager topics={topics} />
    </div>
  );
}
