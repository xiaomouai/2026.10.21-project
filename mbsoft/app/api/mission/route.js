import { NextResponse } from 'next/server'

export async function POST(request){
  const {chapter='当前章节',role='CEO',action='让 AI 领任务'}=await request.json()
  const key=process.env.AI_API_KEY; const base=(process.env.AI_BASE_URL||'https://api.openai.com/v1').replace(/\/$/,''); const model=process.env.AI_MODEL||'gpt-4o-mini'
  const prompt=`你是一个一人公司剧本游戏中的${role}。当前章节是“${chapter}”，玩家动作是“${action}”。请用中文给出：一句剧情推进、一个今天能完成的最小动作、一个可检查证据。不要虚构客户、付款或市场数据。`
  if(key){try{const r=await fetch(`${base}/chat/completions`,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${key}`},body:JSON.stringify({model,messages:[{role:'system',content:'你是证据优先的一人公司运营教练。'},{role:'user',content:prompt}],temperature:.4})});if(r.ok){const d=await r.json();return NextResponse.json({reply:d.choices?.[0]?.message?.content||'AI 未返回内容',provider:'ai'})}}catch(error){console.error('AI provider error',error.message)}}
  return NextResponse.json({reply:`${role}进入「${chapter}」：${action}。\n最小动作：今天完成一个可交付的小结果。\n过关证据：保存原始材料、对象、日期和结果；没有真实证据就不要声称已完成。\n\n当前为本地剧本引擎；配置 AI_API_KEY 后会调用模型。`,provider:'local-fallback'})
}
