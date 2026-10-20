'use client'
import { useEffect, useState } from 'react'

const agents = [['CEO','01'],['市场','02'],['内容','03'],['销售','04'],['研发','05'],['服务','06'],['财务','07']]
export default function LiveBoard(){
  const [tick,setTick]=useState(0)
  useEffect(()=>{const id=setInterval(()=>setTick(v=>v+1),2200);return()=>clearInterval(id)},[])
  return <section className="command-grid"><div className="network"><div className="network-head"><span className="label">AGENT NETWORK / LIVE</span><span className="pulse"><i/>运行中</span></div><div className="orbit"><div className="orbit-ring ring-one"/><div className="orbit-ring ring-two"/><div className="core"><span>OPC</span><small>CONTROL</small></div>{agents.map(([name,id],i)=><div className={`agent a${i} ${i===tick%agents.length?'hot':''}`} key={name}><span>{id}</span><b>{name}</b></div>)}</div><div className="network-foot"><span>WORKFLOW SYNCED</span><span>7 ROLES · 1 OPERATOR</span></div></div><div className="activity"><div className="network-head"><span className="label">EVENT STREAM</span><span className="muted">刚刚更新</span></div><div className="event-list">{['CEO 选择下一条最小实验','市场确认买方与付款场景','内容草稿等待人工审核','财务核对现金证据','销售跟进新线索'].map((e,i)=><div className="event" key={e}><i className={i===tick%5?'active':''}/><span>{e}</span><small>{i*3+1}m</small></div>)}</div><div className="health"><span>系统健康度</span><b>94%</b><div><i/></div></div></div></section>
}
