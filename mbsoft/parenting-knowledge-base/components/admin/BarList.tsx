// 横向条形榜（服务端组件：纯展示，无交互）

export type BarItem = { label: string; value: number };

export default function BarList({
  items,
  colors = ["#7c3aed", "#ec4899"],
  unit = "",
  empty = "暂无数据",
}: {
  items: BarItem[];
  colors?: string[];
  unit?: string;
  empty?: string;
}) {
  if (!items.length) return <div className="a-empty">{empty}</div>;
  const max = Math.max(1, ...items.map((i) => i.value));

  return (
    <div>
      {items.map((it, idx) => {
        const pct = Math.max(3, Math.round((it.value / max) * 100));
        const color = `linear-gradient(90deg, ${colors[0]}, ${colors[1]})`;
        return (
          <div className="bar-row" key={it.label + idx}>
            <span className="bar-label" title={it.label}>
              {it.label}
            </span>
            <span className="bar-track">
              <span className="bar-fill" style={{ width: `${pct}%`, background: color }} />
            </span>
            <span className="bar-value">
              {it.value}
              {unit}
            </span>
          </div>
        );
      })}
    </div>
  );
}
