"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PACKAGES } from "@/lib/packages";

export default function PricingSection({ currentUser }: { currentUser: any }) {
  const [selected, setSelected] = useState("pkg-month");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  async function purchase(packageId: string) {
    if (!currentUser) {
      setError("请先登录后再购买");
      return;
    }
    setLoading(true);
    setError("");
    setMsg("");
    const res = await fetch("/api/purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packageId }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      setMsg(data.message);
      router.refresh();
    } else {
      setError(data.error || "购买失败");
    }
  }

  return (
    <>
      <div className="grid grid-3" style={{ marginTop: 14 }}>
        {PACKAGES.map((pkg) => (
          <div
            key={pkg.id}
            className={`price-card ${pkg.isPopular ? "popular" : ""} ${selected === pkg.id ? "popular" : ""}`}
            onClick={() => setSelected(pkg.id)}
            style={{ cursor: "pointer" }}
          >
            {pkg.isPopular && <span className="popular-badge">最受欢迎</span>}
            <div className="price-name">{pkg.name}</div>
            <div className="price-amount">
              {pkg.price === 0 ? "免费" : `¥${pkg.price}`}
              {pkg.price > 0 && <small> /{pkg.id === "pkg-year" ? "年" : "月"}</small>}
            </div>
            <p className="muted" style={{ fontSize: 13, margin: 0 }}>{pkg.description}</p>
            <ul className="price-features">
              {pkg.features.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
            <button
              className={`btn ${pkg.price === 0 ? "btn-outline" : "btn-primary"} btn-block`}
              onClick={(e) => {
                e.stopPropagation();
                // 付费档位通过「授权卡密钥」激活，统一走 /membership 兑换入口
                if (pkg.price > 0) {
                  router.push("/membership");
                  return;
                }
                purchase(pkg.id);
              }}
              disabled={loading}
            >
              {loading ? "处理中..." : pkg.price === 0 ? "🎁 激活免费体验" : "🔑 用授权卡激活"}
            </button>
          </div>
        ))}
      </div>

      {error && <div className="alert alert-error" style={{ marginTop: 16 }}>{error}</div>}
      {msg && <div className="alert alert-success" style={{ marginTop: 16 }}>{msg}</div>}

      <div className="alert alert-info" style={{ marginTop: 16 }}>
        ℹ️ <strong>开通方式</strong>：月卡 / 年卡由管理员在后台「🎟️ 授权卡」批量生成密钥，用户拿到后在
        <Link href="/membership" style={{ margin: "0 2px" }}>我的会员</Link>
        输入密钥即可激活（月卡 30 天、年卡 365 天，同类会员到期自动顺延）。
      </div>
    </>
  );
}
