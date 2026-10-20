import Link from "next/link";
import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/store";
import { readSiteSettings } from "@/lib/admin";
import { buildInviteUrl, renderQrSvg, resolveOrigin } from "@/lib/invite";
import { formatDate } from "@/lib/format";
import InviteCard from "@/components/InviteCard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "邀请好友 · 好宝宝育儿知识库",
  description: "生成专属邀请二维码，好友注册双方都得积分",
};

export default async function InvitePage() {
  const user = getCurrentUser();
  const site = readSiteSettings();
  const rewardInviter = site.inviteRewardInviter;
  const rewardInvitee = site.inviteRewardInvitee;

  const h = headers();
  const origin = resolveOrigin(h.get("host"), h.get("x-forwarded-proto"));

  const rules = [
    "把二维码或邀请链接分享给身边的妈妈（微信群、朋友圈、小红书都行）",
    `好友通过你的链接注册成功，你立即获得 ${rewardInviter} 积分`,
    `好友额外获得 ${rewardInvitee} 积分，与注册赠送积分叠加`,
    "邀请人数不设上限，多邀多得，积分可用于解锁付费教程",
  ];

  const rulesCard = (
    <div className="card">
      <h3 style={{ margin: "0 0 10px", fontSize: 16 }}>📋 奖励规则</h3>
      <ol className="invite-rules">
        {rules.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ol>
      <p className="hint" style={{ margin: "10px 0 0" }}>
        当前奖励：邀请人 +{rewardInviter} 分 / 好友 +{rewardInvitee} 分（由运营在后台配置）
      </p>
    </div>
  );

  // ---------- 未登录：引导登录后再生成专属邀请码 ----------
  if (!user) {
    return (
      <>
        <h1 className="page-title">🎁 邀请好友</h1>
        <p className="page-sub">
          登录后即可生成你的专属邀请二维码，好友扫码注册，双方都拿积分。
        </p>
        <div className="card center invite-gate">
          <div style={{ fontSize: 44 }}>🔒</div>
          <p style={{ fontWeight: 700, margin: "8px 0 4px" }}>登录后查看你的专属邀请码</p>
          <p className="hint" style={{ marginTop: 0 }}>
            邀请奖励：你得 {rewardInviter} 分，好友额外得 {rewardInvitee} 分
          </p>
          <Link href="/" className="btn btn-primary mt-4">
            去首页登录 / 注册
          </Link>
        </div>
        <div className="mt-4">{rulesCard}</div>
      </>
    );
  }

  // ---------- 已登录：生成邀请码 + 二维码 + 战绩 ----------
  const code = db.ensureInviteCode(user.id);
  const url = buildInviteUrl(code, origin);
  const svg = await renderQrSvg(url, 240);

  const invitees = db.getInviteDetailsByInviter(user.id);
  const earned = invitees.reduce((sum, i) => sum + i.points, 0);
  const inviterRecord = db.getInviteByInvitee(user.id);
  const myInviter = inviterRecord ? db.getUserById(inviterRecord.inviterId) : undefined;

  return (
    <>
      <h1 className="page-title">🎁 邀请好友，一起拿积分</h1>
      <p className="page-sub">
        把专属二维码或链接发给身边的妈妈，好友注册成功后你们双方都能获得积分奖励。
      </p>

      <div className="grid invite-grid mt-4">
        <InviteCard
          code={code}
          url={url}
          svg={svg}
          rewardInviter={rewardInviter}
          rewardInvitee={rewardInvitee}
        />

        <div>
          <div className="card">
            <div className="invite-stats">
              <div className="invite-stat">
                <strong>{invitees.length}</strong>
                <span>已邀请好友</span>
              </div>
              <div className="invite-stat">
                <strong>{earned}</strong>
                <span>邀请获得积分</span>
              </div>
              <div className="invite-stat">
                <strong>{user.points}</strong>
                <span>当前积分余额</span>
              </div>
            </div>
            {myInviter && (
              <div className="alert alert-info" style={{ margin: "0 0 -2px" }}>
                🤝 你是通过 <strong>{myInviter.nickname}</strong> 的邀请加入的
              </div>
            )}
          </div>

          <div className="mt-4">{rulesCard}</div>
        </div>
      </div>

      <section className="mt-6">
        <h2 style={{ fontSize: 17, marginTop: 26, marginBottom: 12 }}>我的好友（{invitees.length}）</h2>
        {invitees.length === 0 ? (
          <div className="card center" style={{ color: "var(--muted)", fontSize: 14 }}>
            还没有好友通过你的邀请加入
            <div className="hint mt-2">把上面的二维码发到妈妈群，试试看 👆</div>
          </div>
        ) : (
          <div className="card" style={{ padding: "6px 18px" }}>
            {invitees.map((i, idx) => (
              <div className="invitee-row" key={i.nickname + i.createdAt + idx}>
                <div className="invitee-avatar">{i.nickname.charAt(0).toUpperCase()}</div>
                <div className="invitee-main">
                  <div className="invitee-name">{i.nickname}</div>
                  <div className="invitee-time">{formatDate(i.createdAt)} 注册</div>
                </div>
                <span className={`tag ${i.hasProfile ? "tag-free" : "tag-premium"}`}>
                  {i.hasProfile ? "已填宝宝档案" : "待完善档案"}
                </span>
                <span className="invitee-points">+{i.points}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
