// 公开二维码接口：GET /api/qr?text=<urlencoded>
// 服务端用 qrcode 生成 SVG，客户端弹窗通过 <img src="/api/qr?text=..."> 引用，
// 避免 client 组件直接依赖 node 侧 qrcode 包。

import QRCode from 'qrcode'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const text = request.nextUrl.searchParams.get('text') || ''
  if (!text || text.length > 512) {
    return new Response('bad request', { status: 400 })
  }
  const svg = await QRCode.toString(text, { type: 'svg', margin: 1, width: 220 })
  return new Response(svg, {
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      'cache-control': 'public, max-age=86400',
    },
  })
}
