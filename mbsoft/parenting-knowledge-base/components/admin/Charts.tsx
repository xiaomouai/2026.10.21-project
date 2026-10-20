"use client";

import { useEffect, useRef, useState } from "react";

export type Series = {
  name: string;
  color: string;
  points: { label: string; value: number }[];
};

// 取整到"好看"的刻度上限（1/2/5 × 10^k）
function niceCeil(v: number): number {
  if (v <= 5) return 5;
  const exp = Math.floor(Math.log10(v));
  const base = Math.pow(10, exp);
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    if (v <= m * base) return m * base;
  }
  return 10 * base;
}

// 平滑折线路径（相邻点中点为控制点，视觉更"丝滑"）
function smoothPath(pts: { x: number; y: number }[]): string {
  if (!pts.length) return "";
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const cx = (pts[i - 1].x + pts[i].x) / 2;
    d += ` C ${cx} ${pts[i - 1].y} ${cx} ${pts[i].y} ${pts[i].x} ${pts[i].y}`;
  }
  return d;
}

export function LineTrend({ series, height = 210 }: { series: Series[]; height?: number }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(660);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const apply = (width: number) => setW(Math.max(260, Math.round(width)));
    apply(el.clientWidth);
    const ro = new ResizeObserver((entries) => apply(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = series[0]?.points.length ?? 0;
  const padL = 32;
  const padR = 14;
  const padT = 16;
  const padB = 26;
  const innerW = Math.max(40, w - padL - padR);
  const innerH = Math.max(40, height - padT - padB);

  const maxVal = Math.max(1, ...series.flatMap((s) => s.points.map((p) => p.value)));
  const top = niceCeil(maxVal);

  const X = (i: number) => padL + (n <= 1 ? innerW / 2 : (i * innerW) / (n - 1));
  const Y = (v: number) => padT + innerH - (v / top) * innerH;

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(top * f));

  function onMove(clientX: number) {
    const el = boxRef.current;
    if (!el || n <= 1) return;
    const rect = el.getBoundingClientRect();
    const rel = clientX - rect.left - padL;
    const idx = Math.round((rel / innerW) * (n - 1));
    setHover(Math.min(n - 1, Math.max(0, idx)));
  }

  const tipLeft = hover !== null ? Math.min(Math.max(X(hover), 70), w - 70) : 0;

  return (
    <div className="chart-box" ref={boxRef} style={{ position: "relative", height }}>
      <svg width={w} height={height} role="img" aria-label="趋势图">
        <defs>
          {series.map((s, i) => (
            <linearGradient key={i} id={`lg-${i}-${s.name}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.26" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>

        {/* 网格与 Y 轴刻度 */}
        {ticks.map((t, i) => (
          <g key={i}>
            <line
              x1={padL}
              x2={padL + innerW}
              y1={Y(t)}
              y2={Y(t)}
              stroke="#eceef5"
              strokeWidth={1}
              strokeDasharray={i === 0 ? undefined : "3 4"}
            />
            <text x={padL - 8} y={Y(t) + 4} textAnchor="end" fontSize={11} fill="#8d90a4">
              {t}
            </text>
          </g>
        ))}

        {/* X 轴标签（等间隔抽稀，避免重叠） */}
        {series[0]?.points.map((p, i) => {
          const step = Math.max(1, Math.ceil(n / 7));
          if (i % step !== 0 && i !== n - 1) return null;
          return (
            <text key={i} x={X(i)} y={height - 8} textAnchor="middle" fontSize={11} fill="#8d90a4">
              {p.label}
            </text>
          );
        })}

        {/* 每条序列 */}
        {series.map((s, si) => {
          const pts = s.points.map((p, i) => ({ x: X(i), y: Y(p.value) }));
          const line = smoothPath(pts);
          const area = `${line} L ${pts[pts.length - 1]?.x ?? padL} ${padT + innerH} L ${pts[0]?.x ?? padL} ${padT + innerH} Z`;
          return (
            <g key={si}>
              <path d={area} fill={`url(#lg-${si}-${s.name})`} />
              <path d={line} fill="none" stroke={s.color} strokeWidth={2.2} strokeLinecap="round" />
              {pts.map((p, i) =>
                i === hover ? (
                  <circle key={i} cx={p.x} cy={p.y} r={4.5} fill="#fff" stroke={s.color} strokeWidth={2.5} />
                ) : null
              )}
            </g>
          );
        })}

        {/* 悬停竖线 */}
        {hover !== null && (
          <line x1={X(hover)} x2={X(hover)} y1={padT} y2={padT + innerH} stroke="#c9cbd8" strokeWidth={1} strokeDasharray="3 3" />
        )}
      </svg>

      {/* 悬停提示（HTML 浮层，避免 SVG 文本宽度计算） */}
      {hover !== null && (
        <div className="chart-tip" style={{ left: tipLeft }}>
          <div className="chart-tip-label">{series[0]?.points[hover]?.label}</div>
          {series.map((s) => (
            <div className="chart-tip-row" key={s.name}>
              <i style={{ background: s.color }} />
              <span>{s.name}</span>
              <b>{s.points[hover]?.value ?? 0}</b>
            </div>
          ))}
        </div>
      )}

      {/* 触屏/鼠标捕获层 */}
      <div
        className="chart-hit"
        onMouseMove={(e) => onMove(e.clientX)}
        onMouseLeave={() => setHover(null)}
        onTouchStart={(e) => onMove(e.touches[0].clientX)}
        onTouchMove={(e) => onMove(e.touches[0].clientX)}
        onTouchEnd={() => setHover(null)}
      />
    </div>
  );
}

// 环形图（占比可视化）
export function Donut({
  items,
  size = 150,
  thickness = 20,
  centerLabel = "总计",
}: {
  items: { label: string; value: number; color: string }[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
}) {
  const total = items.reduce((s, i) => s + i.value, 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;

  return (
    <div className="donut-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="占比图">
        <g transform={`translate(${size / 2}, ${size / 2}) rotate(-90)`}>
          <circle r={r} fill="none" stroke="#f1f2f8" strokeWidth={thickness} />
          {total > 0 &&
            items.map((it, i) => {
              const len = (it.value / total) * c;
              const el = (
                <circle
                  key={i}
                  r={r}
                  fill="none"
                  stroke={it.color}
                  strokeWidth={thickness}
                  strokeDasharray={`${Math.max(0, len - 2)} ${c - Math.max(0, len - 2)}`}
                  strokeDashoffset={-acc}
                  strokeLinecap="round"
                />
              );
              acc += len;
              return el;
            })}
        </g>
        <text x={size / 2} y={size / 2 - 2} textAnchor="middle" fontSize={22} fontWeight={800} fill="#1c1d2b">
          {total}
        </text>
        <text x={size / 2} y={size / 2 + 16} textAnchor="middle" fontSize={11} fill="#8d90a4">
          {centerLabel}
        </text>
      </svg>

      <div className="donut-legend">
        {items.map((it) => (
          <div className="donut-legend-row" key={it.label}>
            <i style={{ background: it.color }} />
            <span className="donut-legend-label">{it.label}</span>
            <b>{it.value}</b>
            <span className="donut-legend-pct">{total ? Math.round((it.value / total) * 100) : 0}%</span>
          </div>
        ))}
        {total === 0 && <div className="a-muted">暂无数据</div>}
      </div>
    </div>
  );
}
