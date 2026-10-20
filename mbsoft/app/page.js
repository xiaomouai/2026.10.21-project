import { execFileSync } from 'node:child_process'
import ChatPanel from './chat/ChatPanel'
import LiveBoard from './visual/LiveBoard'
import MissionBoard from './mission/MissionBoard'

function data() {
  const raw = execFileSync('python3', ['-c', `import sqlite3, json
db=sqlite3.connect('company.db'); db.row_factory=sqlite3.Row
p=db.execute('select name,promise,price from products order by id desc limit 1').fetchone()
f=db.execute('select stage,count(*) n from leads group by stage').fetchall()
c=db.execute("select coalesce(sum(case when kind='income' then amount else 0 end),0) income, coalesce(sum(case when kind='cost' then amount else 0 end),0) cost from cash").fetchone()
print(json.dumps({'product':dict(p) if p else None,'funnel':{x['stage']:x['n'] for x in f},'cash':dict(c)},ensure_ascii=False))`], { encoding: 'utf8' })
  return JSON.parse(raw)
}

export default function Home() {
  const d = data(); const funnel = ['new', 'qualified', 'quoted', 'won', 'lost']
  return <main><header><div><span className="eyebrow">ONE-PERSON COMPANY OS</span><h1>AI 公司驾驶舱</h1><p>一个人，七个角色，一条可追踪的现金闭环。</p></div><button>运行今日周期</button></header>
    <section className="hero"><div><span className="label">当前产品</span><h2>{d.product?.name ?? '未设置产品'}</h2><p>{d.product?.promise ?? '先定义一个可验收的产品承诺'}</p></div><div className="price">¥{d.product?.price ?? 0}<small> / 次</small></div></section><MissionBoard /><LiveBoard />
    <section className="grid"><article><span className="label">销售漏斗</span><div className="funnel">{funnel.map(s => <div className="stage" key={s}><b>{d.funnel[s] ?? 0}</b><span>{s}</span></div>)}</div></article><article><span className="label">现金结果</span><div className="cash">¥{d.cash.income - d.cash.cost}</div><p>收入 ¥{d.cash.income} · 成本 ¥{d.cash.cost}</p></article></section>
    <section className="roles"><span className="label">今日角色周期</span><div className="role-row">{['CEO','市场','内容','销售','研发','客户成功','财务'].map((r,i)=><div className="role" key={r}><i>{String(i+1).padStart(2,'0')}</i>{r}</div>)}</div></section>
    <section className="next"><span className="label">下一条最小行动</span><h3>{d.cash.income === 0 ? '拿到第一个真实报价或定金' : '完成交付并记录结果，再扩大自动化'}</h3><p>本地状态已跑通；公开发布、真实咨询和付款仍需要外部证据。</p></section><ChatPanel />
  </main>
}
