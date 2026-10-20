import { db } from "@/lib/store";
import { getCurrentUser } from "@/lib/auth";
import CheckInButton from "@/components/CheckInButton";
import { scoreTopics, computeStreak, pickDaily } from "@/lib/recommend";

export const dynamic = "force-dynamic";

export default function CheckInPage() {
  const user = getCurrentUser();
  const checkIns = user ? db.getCheckInsByUser(user.id) : [];
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const checkedToday = checkIns.some((c) => c.date === todayStr);

  // 连续打卡天数（统一口径，同时用于推荐动态调权）
  const streak = computeStreak(checkIns);

  // "今日一篇"：按宝宝档案打分，按日期轮换，每天不同
  let dailyPick: { slug: string; title: string; reason?: string } | undefined;
  if (user?.childProfile) {
    const scored = scoreTopics(db.getAllTopics(), user.childProfile, { streak });
    const epochDay = Math.floor(Date.now() / 86400000);
    const pick = pickDaily(scored, epochDay);
    if (pick) {
      dailyPick = { slug: pick.topic.slug, title: pick.topic.title, reason: pick.reasons[0] };
    }
  }

  // 生成当月日历
  const year = today.getFullYear();
  const month = today.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  const datesSet = new Set(checkIns.map((c) => c.date));
  const monthNames = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
  const weekDays = ["日", "一", "二", "三", "四", "五", "六"];

  return (
    <>
      <h1 style={{ fontSize: 24, marginTop: 18 }}>📅 每日打卡</h1>
      <p className="muted">坚持记录，养成习惯。连续打卡有额外积分奖励。</p>

      {/* 打卡英雄区 */}
      <div className="checkin-hero" style={{ marginTop: 14 }}>
        <div className="streak-fire">{checkedToday ? "🔥" : "🌙"}</div>
        <h2>{checkedToday ? "今日已打卡，太棒了！" : "今天记录宝宝睡眠了吗？"}</h2>
        <p style={{ margin: 6, opacity: 0.9 }}>
          当前连续 <strong>{streak}</strong> 天 · 累计打卡 {checkIns.length} 次
        </p>
        {user ? (
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <CheckInButton checkedToday={checkedToday} dailyPick={dailyPick} />
          </div>
        ) : (
          <p style={{ margin: 14 }}>👉 登录后即可打卡赚积分</p>
        )}
      </div>

      {/* 积分规则 */}
      <div className="grid grid-3 keep-3" style={{ marginTop: 16 }}>
        <div className="card center">
          <div style={{ fontSize: 28 }}>📝</div>
          <strong>每日打卡</strong>
          <p className="muted" style={{ fontSize: 13, margin: 4 }}>基础 +10 积分</p>
        </div>
        <div className="card center">
          <div style={{ fontSize: 28 }}>🔥</div>
          <strong>连续奖励</strong>
          <p className="muted" style={{ fontSize: 13, margin: 4 }}>连续第N天 +N（封顶+5）</p>
        </div>
        <div className="card center">
          <div style={{ fontSize: 28 }}>💬</div>
          <strong>发帖互动</strong>
          <p className="muted" style={{ fontSize: 13, margin: 4 }}>每条 +5 积分</p>
        </div>
      </div>

      {/* 日历 */}
      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ margin: "0 0 14px", fontSize: 16 }}>
          {year}年 {monthNames[month]} 打卡记录
        </h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: 6,
            textAlign: "center",
          }}
        >
          {weekDays.map((w) => (
            <div key={w} style={{ fontSize: 12, color: "var(--muted)", padding: 6 }}>
              {w}
            </div>
          ))}
          {cells.map((cell, i) => {
            if (cell === null) return <div key={i} />;
            const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(cell).padStart(2, "0")}`;
            const checked = datesSet.has(dateStr);
            const isToday = dateStr === todayStr;
            return (
              <div
                key={i}
                style={{
                  padding: 8, borderRadius: 8, fontSize: 13,
                  background: checked ? "linear-gradient(135deg,#fbbf24,#f59e0b)" : "#f9f2f7",
                  color: checked ? "#fff" : "var(--muted)",
                  border: isToday ? "2px solid var(--pink)" : "none",
                  fontWeight: isToday ? 700 : 400,
                }}
              >
                {cell}
                {checked && <div style={{ fontSize: 10 }}>✓</div>}
              </div>
            );
          })}
        </div>
        <p className="hint" style={{ marginTop: 12, marginBottom: 0 }}>
          💡 金色日期表示已打卡。坚持 7 天即可养成记录习惯～
        </p>
      </div>
    </>
  );
}
