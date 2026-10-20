"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export type DailyPick = { slug: string; title: string; reason?: string };

export default function CheckInButton({
  checkedToday: initial,
  dailyPick,
}: {
  checkedToday: boolean;
  dailyPick?: DailyPick;
}) {
  const [checked, setChecked] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const router = useRouter();

  async function checkIn() {
    setLoading(true);
    setMsg("");
    const res = await fetch("/api/checkin", { method: "POST" });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      setChecked(true);
      setMsg(`+${data.pointsEarned}积分（连续第${data.streak}天）`);
      router.refresh();
    } else {
      setMsg(data.error || "打卡失败");
    }
  }

  if (checked) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, width: "100%" }}>
        <button className="btn btn-outline btn-sm" disabled title="今日已打卡">
          ✅ 已打卡
        </button>
        {msg && <span className="hint" style={{ fontSize: 11 }}>{msg}</span>}
        {/* 打卡完成 → 顺势推送"今日一篇" */}
        {dailyPick && (
          <Link href={`/topics/${dailyPick.slug}`} className="daily-pick">
            <span className="daily-pick-label">🎯 今日推荐</span>
            <strong>{dailyPick.title}</strong>
            {dailyPick.reason && <span className="daily-pick-reason">匹配：{dailyPick.reason}</span>}
            <span className="daily-pick-go">去阅读 →</span>
          </Link>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
      <button className="btn btn-primary btn-sm" onClick={checkIn} disabled={loading}>
        {loading ? "..." : "📅 打卡"}
      </button>
      {msg && <span className="hint" style={{ fontSize: 11 }}>{msg}</span>}
    </div>
  );
}
