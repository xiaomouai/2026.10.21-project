const TONES = {
  lime: 'badge--lime',
  muted: 'badge--muted',
  warn: 'badge--warn',
  danger: 'badge--danger',
  ok: 'badge--ok',
}

/** 状态徽标：tone 支持 lime / muted / warn / danger / ok */
export default function Badge({ children, tone }) {
  return <span className={`badge ${TONES[tone] || 'badge--muted'}`}>{children}</span>
}
