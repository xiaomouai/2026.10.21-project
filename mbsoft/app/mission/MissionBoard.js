'use client'
import { useState } from 'react'

const chapters=[
  ['01','定位','CEO','说清楚谁付钱、为什么现在买','一个具体买方 + 一个触发场景'],
  ['02','产品','研发','把承诺变成可交付产品','一个价格 + 一个验收结果'],
  ['03','市场','市场','找到真实痛点和反例','三条带来源的证据'],
  ['04','内容','内容','把痛点变成可传播内容','一份内容草稿 + 行动入口'],
  ['05','线索','销售','获得真实对话','一个有效线索 + 需求记录'],
  ['06','报价','销售','让买方做出购买决定','一份窄报价，不能只写意向'],
  ['07','交付','客户成功','交付承诺结果','客户验收或明确反馈'],
  ['08','收款','财务','把结果变成现金证据','到账、订单或合同'],
  ['09','复盘','CEO','决定继续、改一个变量或停止','现金结果 + 下一轮规则']
]

export default function MissionBoard(){
  const [current,setCurrent]=useState(0); const [logs,setLogs]=useState(['系统初始化：剧本《一人公司首笔收入》已开局']); const [busy,setBusy]=useState(false); const [ai,setAi]=useState('等待 AI 角色出场…')
  const chapter=chapters[current]
  async function run(action){setBusy(true); const r=await fetch('/api/mission',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chapter:chapter[1],role:chapter[2],action})}); const d=await r.json(); setAi(d.reply); setLogs(v=>[`${chapter[0]} ${chapter[1]}：${action}`, ...v].slice(0,6)); if(action==='过关' && current<chapters.length-1)setCurrent(v=>v+1); setBusy(false)}
  return <section className="mission"><div className="mission-head"><div><span className="label">MISSION CONTROL / STORY MODE</span><h2>《一人公司首笔收入》</h2><p>每一关都必须留下证据。没有证据，不能解锁下一章。</p></div><div className="mission-score"><b>{current+1}<small> / {chapters.length}</small></b><span>章节进度</span></div></div><div className="chapter-track">{chapters.map((c,i)=><button aria-label={`第${c[0]}关 ${c[1]}`} className={`${i<current?'done ':''}${i===current?'current':''}`} onClick={()=>i<=current&&setCurrent(i)} key={c[0]}><i>{i<current?'✓':c[0]}</i><span>{c[1]}</span></button>)}</div><div className="mission-body"><div className="brief"><span className="label">当前关卡 · {chapter[2]}</span><h3>{chapter[1]}：{chapter[3]}</h3><div className="gate"><span>过关条件</span><b>{chapter[4]}</b></div><div className="mission-actions"><button disabled={busy} onClick={()=>run('让 AI 领任务')}>AI 领任务</button><button className="ghost" disabled={busy} onClick={()=>run('过关')}>确认过关 →</button></div></div><div className="ai-console"><div className="console-top"><span>AI ROLE CONSOLE</span><span className="online">{busy?'PROCESSING':'READY'}</span></div><div className="ai-reply">{ai}</div><div className="logs">{logs.map((l,i)=><div key={`${l}-${i}`}><i/> {l}</div>)}</div></div></div></section>
}
