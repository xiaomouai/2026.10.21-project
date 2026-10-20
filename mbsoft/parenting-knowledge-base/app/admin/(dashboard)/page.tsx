import Link from "next/link";
import { getAdminStats } from "@/lib/admin-stats";
import { LineTrend, Donut } from "@/components/admin/Charts";
import BarList from "@/components/admin/BarList";
import { CHART_COLORS, formatMoney, formatRelative } from "@/lib/format";

export const dynamic = "force-dynamic";

function Stat({
  icon,
  label,
  value,
  unit,
  foot,
}: {
  icon: string;
  label: string;
  value: string | number;
  unit?: string;
  foot?: React.ReactNode;
}) {
  return (
    <div className="stat-card">
      <span className="stat-ico" aria-hidden>{icon}</span>
      <span className="stat-label">{label}</span>
      <span className="stat-value">
        {value}
        {unit && <small>{unit}</small>}
      </span>
      {foot && <span className="stat-delta">{foot}</span>}
    </div>
  );
}

export default function AdminDashboardPage() {
  const s = getAdminStats(14);

  const weekDelta = s.user7d - s.userPrev7d;
  const weekPct =
    s.userPrev7d > 0 ? Math.round((weekDelta / s.userPrev7d) * 1000) / 10 : s.user7d > 0 ? 100 : 0;

  const feedingItems = s.feedingDist.map((f, i) => ({
    label: f.label,
    value: f.value,
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));

  return (
    <div className="a-stack">
      {/* 核心指标 */}
      <div className="stat-grid">
        <Stat
          icon="👥"
          label="注册会员"
          value={s.userTotal}
          unit="人"
          foot={
            <>
              今日新增 <b>{s.userToday}</b> 人
            </>
          }
        />
        <Stat
          icon="📅"
          label="累计打卡"
          value={s.checkInTotal}
          unit="次"
          foot={
            <>
              今日打卡 <b>{s.checkInToday}</b> 次
            </>
          }
        />
        <Stat
          icon="💬"
          label="论坛内容"
          value={s.postTotal}
          unit="帖"
          foot={
            <>
              回复 <b>{s.replyTotal}</b> 条 · 今日 <b>{s.postToday}</b> 帖
            </>
          }
        />
        <Stat
          icon="💰"
          label="内容收入"
          value={`¥${formatMoney(s.revenue)}`}
          foot={
            <>
              订单 <b>{s.orderTotal}</b> 笔
            </>
          }
        />
      </div>

      <div className="stat-grid">
        <Stat
          icon="🔥"
          label="7 日活跃用户"
          value={s.active7d}
          unit="人"
          foot={
            <>
              近 7 天有打卡行为
            </>
          }
        />
        <Stat
          icon="💎"
          label="付费会员"
          value={s.paidUsers}
          unit="人"
          foot={
            <>
              人均积分 <b>{s.avgPoints}</b>
            </>
          }
        />
        <Stat
          icon="📈"
          label="付费转化率"
          value={s.conversion}
          unit="%"
          foot={
            <>
              已填写宝宝档案 <b>{s.memberWithProfile}</b> 人
            </>
          }
        />
        <Stat
          icon="👀"
          label="内容总浏览"
          value={s.viewTotal}
          unit="次"
          foot={
            <>
              教程 <b>{s.topicTotal}</b> 篇（付费 <b>{s.premiumTotal}</b>）
            </>
          }
        />
      </div>

      {/* 邀请增长 */}
      <div className="stat-grid">
        <Stat
          icon="🎁"
          label="邀请注册会员"
          value={s.invitedUsers}
          unit="人"
          foot={
            <>
              占全部注册 <b>{s.inviteRate}%</b>
            </>
          }
        />
        <Stat
          icon="🤝"
          label="累计成功邀请"
          value={s.inviteTotal}
          unit="次"
          foot={
            <>
              今日邀请 <b>{s.inviteToday}</b> 次
            </>
          }
        />
        <Stat
          icon="🏅"
          label="邀请达人"
          value={s.inviteLeaderboard[0]?.nickname ?? "—"}
          foot={
            s.inviteLeaderboard[0] ? (
              <>
                已邀请 <b>{s.inviteLeaderboard[0].count}</b> 人
              </>
            ) : (
              <>暂无邀请数据</>
            )
          }
        />
        <Stat
          icon="🎫"
          label="邀请奖励发放"
          value={s.inviteRewardTotal}
          unit="积分"
          foot={<>邀请人 + 被邀请人合计</>}
        />
      </div>

      {/* 趋势 */}
      <div className="a-card">
        <div className="a-card-head">
          <div>
            <h2>近 14 天趋势</h2>
            <div className="a-card-sub">
              近 7 天新增注册 {s.user7d} 人
              {s.userPrev7d > 0 && (
                <>
                  {" · "}
                  <span style={{ color: weekDelta >= 0 ? "var(--a-green)" : "var(--a-red)" }}>
                    环比{weekDelta >= 0 ? "+" : ""}
                    {weekPct}%
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        <LineTrend
          height={220}
          series={[
            { name: "新增注册", color: CHART_COLORS[0], points: s.userTrend },
            { name: "打卡次数", color: CHART_COLORS[1], points: s.checkInTrend },
            { name: "邀请注册", color: CHART_COLORS[2], points: s.inviteTrend },
          ]}
        />
        <div className="chart-legend">
          <span>
            <i style={{ background: CHART_COLORS[0] }} />
            新增注册（人）
          </span>
          <span>
            <i style={{ background: CHART_COLORS[1] }} />
            打卡次数（次）
          </span>
          <span>
            <i style={{ background: CHART_COLORS[2] }} />
            邀请注册（人）
          </span>
          <span className="a-muted">鼠标 / 手指按在图上查看每天明细</span>
        </div>
      </div>

      {/* 邀请达人榜 */}
      <div className="a-card">
        <div className="a-card-head">
          <div>
            <h2>🏅 邀请达人榜 TOP 5</h2>
            <div className="a-card-sub">按成功邀请人数排序，可用作运营激励参考</div>
          </div>
        </div>
        <div className="a-table-wrap">
          <table className="a-table">
            <thead>
              <tr>
                <th className="nowrap">排名</th>
                <th>昵称</th>
                <th className="nowrap">邀请人数</th>
                <th className="nowrap">获得积分</th>
              </tr>
            </thead>
            <tbody>
              {s.inviteLeaderboard.map((row, i) => (
                <tr key={row.nickname + i}>
                  <td className="nowrap">{["🥇", "🥈", "🥉", "4", "5"][i]}</td>
                  <td>{row.nickname}</td>
                  <td className="nowrap a-mono">{row.count}</td>
                  <td className="nowrap a-mono">{row.points}</td>
                </tr>
              ))}
              {s.inviteLeaderboard.length === 0 && (
                <tr>
                  <td colSpan={4} className="a-empty">
                    还没有会员通过邀请带来新用户
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 用户画像 */}
      <div className="a-grid-2e">
        <div className="a-card">
          <div className="a-card-head">
            <div>
              <h2>宝宝月龄分布</h2>
              <div className="a-card-sub">来自注册后的宝宝情况调研</div>
            </div>
          </div>
          <BarList items={s.ageDist} unit=" 人" empty="还没有会员填写宝宝档案" />
        </div>

        <div className="a-card">
          <div className="a-card-head">
            <div>
              <h2>Top 育儿困扰</h2>
              <div className="a-card-sub">决定知识库选题优先级</div>
            </div>
          </div>
          <BarList items={s.painDist} unit=" 人" colors={["#ec4899", "#f59e0b"]} empty="暂无调研数据" />
        </div>
      </div>

      <div className="a-grid-2e">
        <div className="a-card">
          <div className="a-card-head">
            <div>
              <h2>喂养方式构成</h2>
              <div className="a-card-sub">用于夜奶类内容的精细化推荐</div>
            </div>
          </div>
          <Donut items={feedingItems} centerLabel="已填档案" />
        </div>

        <div className="a-card">
          <div className="a-card-head">
            <div>
              <h2>教程浏览量 Top 6</h2>
              <div className="a-card-sub">按累计阅读量排序</div>
            </div>
            <div className="a-card-head-spacer" />
            <Link className="a-btn a-btn-sm" href="/admin/topics">
              管理知识库
            </Link>
          </div>
          <div className="a-table-wrap">
            <table className="a-table">
              <thead>
                <tr>
                  <th>教程</th>
                  <th className="nowrap">类型</th>
                  <th className="nowrap">浏览量</th>
                </tr>
              </thead>
              <tbody>
                {s.topTopics.map((t) => (
                  <tr key={t.slug}>
                    <td>
                      <Link href={`/topics/${t.slug}`} target="_blank" rel="noreferrer">
                        {t.title}
                      </Link>
                    </td>
                    <td className="nowrap">
                      {t.isPremium ? (
                        <span className="a-badge a-badge-amber">付费</span>
                      ) : (
                        <span className="a-badge a-badge-green">免费</span>
                      )}
                    </td>
                    <td className="nowrap a-mono">{t.views}</td>
                  </tr>
                ))}
                {s.topTopics.length === 0 && (
                  <tr>
                    <td colSpan={3} className="a-empty">
                      还没有教程
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 最近动态 */}
      <div className="a-grid-2e">
        <div className="a-card">
          <div className="a-card-head">
            <div>
              <h2>最新注册会员</h2>
            </div>
            <div className="a-card-head-spacer" />
            <Link className="a-btn a-btn-sm" href="/admin/members">
              全部会员
            </Link>
          </div>
          <div className="a-table-wrap">
            <table className="a-table">
              <thead>
                <tr>
                  <th>昵称</th>
                  <th>邮箱</th>
                  <th className="nowrap">注册时间</th>
                </tr>
              </thead>
              <tbody>
                {s.recentUsers.map((u) => (
                  <tr key={u.id}>
                    <td>
                      {u.nickname}
                      {u.role === "admin" && (
                        <>
                          {" "}
                          <span className="a-badge a-badge-admin">管理员</span>
                        </>
                      )}
                    </td>
                    <td className="a-muted">{u.email}</td>
                    <td className="nowrap a-muted">{formatRelative(u.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="a-card">
          <div className="a-card-head">
            <div>
              <h2>最新论坛动态</h2>
            </div>
            <div className="a-card-head-spacer" />
            <Link className="a-btn a-btn-sm" href="/forum" target="_blank" rel="noreferrer">
              查看论坛
            </Link>
          </div>
          <div className="a-table-wrap">
            <table className="a-table">
              <thead>
                <tr>
                  <th>用户</th>
                  <th>内容</th>
                  <th className="nowrap">时间</th>
                </tr>
              </thead>
              <tbody>
                {s.recentPosts.map((p) => (
                  <tr key={p.id}>
                    <td className="nowrap">{p.nickname}</td>
                    <td
                      style={{
                        maxWidth: 220,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={p.content}
                    >
                      {p.content}
                    </td>
                    <td className="nowrap a-muted">{formatRelative(p.createdAt)}</td>
                  </tr>
                ))}
                {s.recentPosts.length === 0 && (
                  <tr>
                    <td colSpan={3} className="a-empty">
                      暂无帖子
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
