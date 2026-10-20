"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { MemberRow } from "@/lib/admin-stats";
import { AGE_LABELS } from "@/lib/recommend";
import { formatDateTime, formatMoney, formatRelative } from "@/lib/format";

type Modal =
  | { type: "detail"; row: MemberRow }
  | { type: "points"; row: MemberRow }
  | { type: "pwd"; row: MemberRow }
  | { type: "delete"; row: MemberRow }
  | null;

const PAGE_SIZE = 10;

export default function MemberManager({
  rows,
  currentAdminId,
}: {
  rows: MemberRow[];
  currentAdminId: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "user">("all");
  const [profileFilter, setProfileFilter] = useState<"all" | "filled" | "empty">("all");
  const [sort, setSort] = useState<"new" | "points" | "checkin" | "amount" | "invite">("new");
  const [page, setPage] = useState(1);

  const [modal, setModal] = useState<Modal>(null);
  const [pointsInput, setPointsInput] = useState("0");
  const [pwdInput, setPwdInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    let list = rows.filter((r) => {
      if (kw && !r.nickname.toLowerCase().includes(kw) && !r.phone.includes(kw) && !r.email.toLowerCase().includes(kw)) return false;
      if (roleFilter !== "all" && r.role !== roleFilter) return false;
      if (profileFilter === "filled" && !r.profile) return false;
      if (profileFilter === "empty" && r.profile) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      if (sort === "points") return b.points - a.points;
      if (sort === "checkin") return b.checkInCount - a.checkInCount;
      if (sort === "amount") return b.amount - a.amount;
      if (sort === "invite") return b.inviteCount - a.inviteCount;
      return a.createdAt < b.createdAt ? 1 : -1;
    });
    return list;
  }, [rows, q, roleFilter, profileFilter, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const filledCount = rows.filter((r) => r.profile).length;

  async function call(path: string, method: string, body?: unknown) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(path, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ ok: false, text: data.error || "操作失败" });
        return false;
      }
      setMsg({ ok: true, text: data.message || "操作成功" });
      router.refresh();
      return true;
    } catch {
      setMsg({ ok: false, text: "网络异常，请重试" });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function savePoints() {
    if (modal?.type !== "points") return;
    const n = Number(pointsInput);
    if (!Number.isFinite(n)) {
      setMsg({ ok: false, text: "请输入数字" });
      return;
    }
    if (await call(`/api/admin/users/${modal.row.id}`, "PATCH", { points: Math.max(0, Math.round(n)) })) {
      setModal(null);
    }
  }

  async function savePassword() {
    if (modal?.type !== "pwd") return;
    if (pwdInput.trim().length < 6) {
      setMsg({ ok: false, text: "密码至少 6 位" });
      return;
    }
    if (await call(`/api/admin/users/${modal.row.id}`, "POST", { password: pwdInput.trim() })) {
      setModal(null);
      setPwdInput("");
    }
  }

  async function toggleRole(row: MemberRow) {
    const next = row.role === "admin" ? "user" : "admin";
    await call(`/api/admin/users/${row.id}`, "PATCH", { role: next });
  }

  async function removeUser(row: MemberRow) {
    if (await call(`/api/admin/users/${row.id}`, "DELETE")) setModal(null);
  }

  function profileText(r: MemberRow): string {
    if (!r.profile) return "未填写";
    const age = AGE_LABELS[r.profile.ageBand] ?? r.profile.ageBand;
    const pains = r.profile.pains?.slice(0, 2).join("、") ?? "";
    return `${age}${pains ? " · " + pains : ""}`;
  }

  function membershipCell(r: MemberRow): { label: string; expired: boolean } {
    if (r.membershipType === "none") return { label: "未开通", expired: false };
    const active = r.membershipUntil ? new Date(r.membershipUntil).getTime() > Date.now() : false;
    if (!active) return { label: "已过期", expired: true };
    return { label: r.membershipType === "year" ? "年度会员" : "月度会员", expired: false };
  }

  return (
    <>
      {msg && <div className={`a-alert ${msg.ok ? "a-alert-ok" : "a-alert-err"}`}>{msg.text}</div>}

      <div className="a-card">
        <div className="a-toolbar">
          <input
            className="a-input"
            style={{ minWidth: 210 }}
            placeholder="搜索昵称或邮箱…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
          <select
            className="a-select"
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value as any);
              setPage(1);
            }}
          >
            <option value="all">全部角色</option>
            <option value="user">普通会员</option>
            <option value="admin">管理员</option>
          </select>
          <select
            className="a-select"
            value={profileFilter}
            onChange={(e) => {
              setProfileFilter(e.target.value as any);
              setPage(1);
            }}
          >
            <option value="all">档案：全部</option>
            <option value="filled">已填宝宝档案</option>
            <option value="empty">未填宝宝档案</option>
          </select>
          <select className="a-select" value={sort} onChange={(e) => setSort(e.target.value as any)}>
            <option value="new">按注册时间</option>
            <option value="points">按积分</option>
            <option value="checkin">按打卡次数</option>
            <option value="amount">按消费金额</option>
            <option value="invite">按邀请人数</option>
          </select>
          <span className="a-muted" style={{ marginLeft: "auto", whiteSpace: "nowrap" }}>
            共 {filtered.length} 人 · 已填档案 {filledCount} 人
          </span>
        </div>

        <div className="a-table-wrap">
          <table className="a-table">
            <thead>
              <tr>
                <th>会员</th>
                <th className="nowrap">宝宝档案</th>
                <th className="nowrap">会员档位</th>
                <th className="nowrap">积分</th>
                <th className="nowrap">打卡</th>
                <th className="nowrap">发帖</th>
                <th className="nowrap">消费</th>
                <th className="nowrap">邀请</th>
                <th className="nowrap">注册时间</th>
                <th className="nowrap">操作</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>
                      {r.nickname}
                      {r.role === "admin" && (
                        <>
                          {" "}
                          <span className="a-badge a-badge-admin">管理员</span>
                        </>
                      )}
                    </div>
                    <div className="a-muted" style={{ fontSize: 12 }}>
                      {r.phone}
                    </div>
                  </td>
                  <td>
                    {r.profile ? (
                      <span className="a-badge a-badge-violet">{profileText(r)}</span>
                    ) : (
                      <span className="a-muted">未填写</span>
                    )}
                  </td>
                  <td>
                    {membershipCell(r).label}
                    {r.membershipUntil && membershipCell(r).expired === false && (
                      <div className="a-muted" style={{ fontSize: 12 }}>
                        至 {r.membershipUntil.slice(0, 10)}
                      </div>
                    )}
                  </td>
                  <td className="nowrap a-mono">
                    ⭐ {r.points}
                    <button
                      className="a-btn a-btn-sm"
                      style={{ marginLeft: 8 }}
                      onClick={() => {
                        setModal({ type: "points", row: r });
                        setPointsInput(String(r.points));
                      }}
                      title="调整积分"
                    >
                      调整
                    </button>
                  </td>
                  <td className="nowrap a-mono">
                    {r.checkInCount} 次
                    {r.streak > 0 && (
                      <>
                        {" "}
                        <span className="a-badge a-badge-amber">🔥{r.streak}</span>
                      </>
                    )}
                    <div className="a-muted" style={{ fontSize: 12 }}>
                      {r.lastCheckIn || "未打卡"}
                    </div>
                  </td>
                  <td className="nowrap a-mono">{r.postCount}</td>
                  <td className="nowrap a-mono">
                    {r.orderCount > 0 ? `¥${formatMoney(r.amount)}` : "—"}
                    {r.orderCount > 0 && (
                      <div className="a-muted" style={{ fontSize: 12 }}>
                        {r.orderCount} 笔
                      </div>
                    )}
                  </td>
                  <td className="nowrap a-mono">
                    {r.inviteCount > 0 ? (
                      <>
                        <span className="a-badge a-badge-green">{r.inviteCount} 人</span>
                        <div className="a-muted" style={{ fontSize: 12 }}>
                          邀请码 {r.inviteCode || "—"}
                        </div>
                      </>
                    ) : (
                      <span className="a-muted">—</span>
                    )}
                    {r.invitedByNickname && (
                      <div className="a-muted" style={{ fontSize: 12 }}>
                        由 {r.invitedByNickname} 邀请
                      </div>
                    )}
                  </td>
                  <td className="nowrap a-muted">{formatRelative(r.createdAt)}</td>
                  <td className="nowrap">
                    <button className="a-btn a-btn-sm" onClick={() => setModal({ type: "detail", row: r })}>
                      详情
                    </button>{" "}
                    <button
                      className="a-btn a-btn-sm"
                      disabled={busy || (r.role === "admin" && rows.filter((x) => x.role === "admin").length <= 1)}
                      onClick={() => toggleRole(r)}
                    >
                      {r.role === "admin" ? "取消管理" : "设为管理"}
                    </button>{" "}
                    <button
                      className="a-btn a-btn-sm a-btn-danger"
                      disabled={busy || r.id === currentAdminId}
                      onClick={() => setModal({ type: "delete", row: r })}
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
              {paged.length === 0 && (
                <tr>
                  <td colSpan={10} className="a-empty">
                    没有符合条件的会员
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, justifyContent: "flex-end" }}>
            <button className="a-btn a-btn-sm" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>
              上一页
            </button>
            <span className="a-muted">
              第 {safePage} / {totalPages} 页
            </span>
            <button className="a-btn a-btn-sm" disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)}>
              下一页
            </button>
          </div>
        )}
      </div>

      {/* ---------- 会员详情 ---------- */}
      {modal?.type === "detail" && (
        <div className="a-modal-backdrop" onClick={() => setModal(null)}>
          <div className="a-modal" onClick={(e) => e.stopPropagation()}>
            <div className="a-modal-head">
              <h3>会员详情 · {modal.row.nickname}</h3>
              <div className="a-card-head-spacer" />
              <button className="a-close" onClick={() => setModal(null)}>
                ✕
              </button>
            </div>
            <div className="a-modal-body">
              <dl className="a-dl">
                <dt>会员 ID</dt>
                <dd className="a-mono">{modal.row.id}</dd>
                <dt>邮箱</dt>
                <dd>{modal.row.email}</dd>
                <dt>角色</dt>
                <dd>
                  {modal.row.role === "admin" ? (
                    <span className="a-badge a-badge-admin">管理员</span>
                  ) : (
                    <span className="a-badge">普通会员</span>
                  )}
                </dd>
                <dt>手机号</dt>
                <dd>{modal.row.phone}</dd>
                <dt>会员档位</dt>
                <dd>
                  {membershipCell(modal.row).label}
                  {modal.row.membershipUntil && membershipCell(modal.row).expired === false && (
                    <> · 至 {modal.row.membershipUntil.slice(0, 10)}</>
                  )}
                </dd>
                <dt>注册时间</dt>
                <dd>{formatDateTime(modal.row.createdAt)}</dd>
                <dt>积分</dt>
                <dd>⭐ {modal.row.points}</dd>
                <dt>打卡</dt>
                <dd>
                  {modal.row.checkInCount} 次
                  {modal.row.streak > 0 && ` · 当前连击 ${modal.row.streak} 天`}
                  {modal.row.lastCheckIn && ` · 最近 ${modal.row.lastCheckIn}`}
                </dd>
                <dt>发帖</dt>
                <dd>{modal.row.postCount} 条（含回复）</dd>
                <dt>消费</dt>
                <dd>
                  {modal.row.orderCount > 0
                    ? `¥${formatMoney(modal.row.amount)} / ${modal.row.orderCount} 笔`
                    : "暂无付费记录"}
                </dd>
                <dt>邀请码</dt>
                <dd className="a-mono">{modal.row.inviteCode || "—"}</dd>
                <dt>邀请战绩</dt>
                <dd>
                  成功邀请 {modal.row.inviteCount} 人
                  {modal.row.invitedByNickname && ` · 由「${modal.row.invitedByNickname}」邀请注册`}
                </dd>
              </dl>

              <div className="divider" style={{ margin: "16px 0" }} />

              <h3 style={{ fontSize: 14, margin: "0 0 10px" }}>宝宝档案</h3>
              {modal.row.profile ? (
                <dl className="a-dl">
                  <dt>月龄段</dt>
                  <dd>{AGE_LABELS[modal.row.profile.ageBand] ?? modal.row.profile.ageBand}</dd>
                  <dt>主要困扰</dt>
                  <dd>{modal.row.profile.pains?.join("、") || "—"}</dd>
                  <dt>喂养方式</dt>
                  <dd>{modal.row.profile.feeding || "—"}</dd>
                  <dt>期望目标</dt>
                  <dd>{modal.row.profile.goal || "—"}</dd>
                  <dt>更新时间</dt>
                  <dd>{formatDateTime(modal.row.profile.updatedAt)}</dd>
                </dl>
              ) : (
                <div className="a-alert a-alert-warn" style={{ margin: 0 }}>
                  该会员尚未填写宝宝档案，个性化推荐暂未生效。
                </div>
              )}
            </div>
            <div className="a-modal-foot">
              <button
                className="a-btn"
                onClick={() => {
                  setModal({ type: "pwd", row: modal.row });
                  setPwdInput("");
                }}
              >
                重置密码
              </button>
              <button
                className="a-btn"
                onClick={() => {
                  setModal({ type: "points", row: modal.row });
                  setPointsInput(String(modal.row.points));
                }}
              >
                调整积分
              </button>
              <button className="a-btn a-btn-primary" onClick={() => setModal(null)}>
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- 调整积分 ---------- */}
      {modal?.type === "points" && (
        <div className="a-modal-backdrop" onClick={() => setModal(null)}>
          <div className="a-modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="a-modal-head">
              <h3>调整积分 · {modal.row.nickname}</h3>
              <div className="a-card-head-spacer" />
              <button className="a-close" onClick={() => setModal(null)}>
                ✕
              </button>
            </div>
            <div className="a-modal-body">
              <div className="a-field">
                <label>当前积分：⭐ {modal.row.points}</label>
                <input
                  className="a-input"
                  type="number"
                  min={0}
                  value={pointsInput}
                  onChange={(e) => setPointsInput(e.target.value)}
                />
                <div className="a-tip">输入新的积分总数（覆盖，不是增量）</div>
              </div>
              <div className="a-row">
                {[10, 50, 100].map((n) => (
                  <button
                    key={n}
                    className="a-btn"
                    onClick={() => setPointsInput(String(modal.row.points + n))}
                  >
                    +{n}
                  </button>
                ))}
                <button
                  className="a-btn"
                  onClick={() => setPointsInput(String(Math.max(0, modal.row.points - 10)))}
                >
                  -10
                </button>
              </div>
            </div>
            <div className="a-modal-foot">
              <button className="a-btn" onClick={() => setModal(null)}>
                取消
              </button>
              <button className="a-btn a-btn-primary" disabled={busy} onClick={savePoints}>
                {busy ? "保存中…" : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- 重置密码 ---------- */}
      {modal?.type === "pwd" && (
        <div className="a-modal-backdrop" onClick={() => setModal(null)}>
          <div className="a-modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="a-modal-head">
              <h3>重置密码 · {modal.row.nickname}</h3>
              <div className="a-card-head-spacer" />
              <button className="a-close" onClick={() => setModal(null)}>
                ✕
              </button>
            </div>
            <div className="a-modal-body">
              <div className="a-field">
                <label htmlFor="new-pwd">新密码</label>
                <input
                  id="new-pwd"
                  className="a-input"
                  type="text"
                  placeholder="至少 6 位"
                  value={pwdInput}
                  onChange={(e) => setPwdInput(e.target.value)}
                />
                <div className="a-tip">重置后请通过站内或线下渠道告知会员，建议其登录后自行修改。</div>
              </div>
            </div>
            <div className="a-modal-foot">
              <button className="a-btn" onClick={() => setModal(null)}>
                取消
              </button>
              <button className="a-btn a-btn-primary" disabled={busy} onClick={savePassword}>
                {busy ? "重置中…" : "确认重置"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- 删除确认 ---------- */}
      {modal?.type === "delete" && (
        <div className="a-modal-backdrop" onClick={() => setModal(null)}>
          <div className="a-modal" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div className="a-modal-head">
              <h3>删除会员</h3>
              <div className="a-card-head-spacer" />
              <button className="a-close" onClick={() => setModal(null)}>
                ✕
              </button>
            </div>
            <div className="a-modal-body">
              <div className="a-alert a-alert-err" style={{ marginBottom: 10 }}>
                该操作不可撤销。
              </div>
              <p style={{ margin: 0, fontSize: 14 }}>
                确认删除会员 <b>{modal.row.nickname}</b>（{modal.row.phone}）？
                <br />
                将同时删除其 <b>{modal.row.checkInCount}</b> 条打卡记录、<b>{modal.row.postCount}</b> 条论坛内容
                {modal.row.orderCount > 0 && (
                  <>
                    、<b>{modal.row.orderCount}</b> 笔订单记录
                  </>
                )}
                。
              </p>
            </div>
            <div className="a-modal-foot">
              <button className="a-btn" onClick={() => setModal(null)}>
                取消
              </button>
              <button className="a-btn a-btn-danger" disabled={busy} onClick={() => removeUser(modal.row)}>
                {busy ? "删除中…" : "确认删除"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
