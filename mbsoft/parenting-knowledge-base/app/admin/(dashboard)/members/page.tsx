import { getAdminUser } from "@/lib/admin";
import { getMemberRows } from "@/lib/admin-stats";
import MemberManager from "@/components/admin/MemberManager";
import { formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

export default function AdminMembersPage() {
  const admin = getAdminUser()!;
  const rows = getMemberRows();

  const admins = rows.filter((r) => r.role === "admin").length;
  const filled = rows.filter((r) => r.profile).length;
  const revenue = rows.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="a-stack">
      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-ico" aria-hidden>👥</span>
          <span className="stat-label">会员总数</span>
          <span className="stat-value">{rows.length}<small>人</small></span>
          <span className="stat-delta">管理员 <b>{admins}</b> 人</span>
        </div>
        <div className="stat-card">
          <span className="stat-ico" aria-hidden>📝</span>
          <span className="stat-label">已填宝宝档案</span>
          <span className="stat-value">{filled}<small>人</small></span>
          <span className="stat-delta">
            填写率 <b>{rows.length ? Math.round((filled / rows.length) * 100) : 0}%</b>
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-ico" aria-hidden>🔥</span>
          <span className="stat-label">坚持打卡会员</span>
          <span className="stat-value">{rows.filter((r) => r.streak > 0).length}<small>人</small></span>
          <span className="stat-delta">当前连击 ≥ 1 天</span>
        </div>
        <div className="stat-card">
          <span className="stat-ico" aria-hidden>💰</span>
          <span className="stat-label">累计消费</span>
          <span className="stat-value">¥{formatMoney(Math.round(revenue * 100) / 100)}</span>
          <span className="stat-delta">
            付费会员 <b>{rows.filter((r) => r.orderCount > 0).length}</b> 人
          </span>
        </div>
      </div>

      <MemberManager rows={rows} currentAdminId={admin.id} />
    </div>
  );
}
