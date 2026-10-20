import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/store";
import PricingSection from "@/components/PricingSection";
import { membershipStatus, tierLabel, maskPhone } from "@/lib/access";

export const dynamic = "force-dynamic";

export default function PricingPage() {
  const user = getCurrentUser();
  const m = membershipStatus(user);
  const hasActive = m.active;

  return (
    <>
      <h1 style={{ fontSize: 24, marginTop: 18 }}>💎 会员方案</h1>
      <p className="muted">
        月卡 / 年卡通过<strong>授权卡密钥</strong>激活：月卡 30 天可看全部普内容，年卡 365 天解锁全部内容（含付费教程）。
      </p>

      {user && (
        <div className="card" style={{ marginTop: 14, background: hasActive ? "#d1fae5" : "#fef3c7", border: "none" }}>
          {hasActive ? (
            <>
              <strong>✅ {user.nickname}，{tierLabel(m.tier)}生效中</strong>
              <p className="muted" style={{ fontSize: 13, margin: "6px 0 0" }}>
                {maskPhone(user.phone)} · 有效期至 {m.until?.slice(0, 10)}（剩余 {m.daysLeft} 天）· 当前积分 <strong>{user.points}</strong>
              </p>
            </>
          ) : (
            <>
              <strong>👋 {user.nickname}，你尚未激活会员</strong>
              <p className="muted" style={{ fontSize: 13, margin: "6px 0 0" }}>
                {maskPhone(user.phone)} · 当前仅可试读摘要 · 前往
                <Link href="/membership" style={{ marginLeft: 4 }}>我的会员</Link> 输入授权卡密钥激活
              </p>
            </>
          )}
        </div>
      )}

      <PricingSection currentUser={user} />

      {/* 权益对比 */}
      <div className="card" style={{ marginTop: 20 }}>
        <h3 style={{ margin: "0 0 14px", fontSize: 17 }}>权益对比</h3>
        <div className="table-wrap">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ background: "#fce7f3" }}>
              <th style={{ padding: 10, textAlign: "left" }}>功能</th>
              <th style={{ padding: 10, textAlign: "center" }}>免费体验</th>
              <th style={{ padding: 10, textAlign: "center" }}>月度会员</th>
              <th style={{ padding: 10, textAlign: "center" }}>年度会员</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["普内容（非付费教程）", "摘要试读", "✅ 全文", "✅ 全文"],
              ["全部内容（含付费教程）", "🔒", "🔒", "✅ 全文"],
              ["每日打卡积分", "✅", "✅", "✅"],
              ["论坛发帖互动", "✅", "✅", "✅"],
              ["AI 育儿助手", "1 次体验", "1 次体验", "✅ 不限次"],
            ].map((row, i) => (
              <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                {row.map((cell, j) => (
                  <td
                    key={j}
                    style={{
                      padding: 10,
                      textAlign: j === 0 ? "left" : "center",
                      fontWeight: j === 0 ? 600 : 400,
                    }}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </>
  );
}
