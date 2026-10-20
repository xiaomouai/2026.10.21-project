// 服务端二维码组件：用 qrcode 生成 SVG 字符串并内联渲染。
// 必须在 Server Component 中使用（依赖 node 模块），不要加 'use client'。

import QRCode from 'qrcode'

/**
 * @param {{ text: string, size?: number, className?: string }} props
 */
export default async function QrCode({ text, size = 120, className = 'qrBox' }) {
  const svg = await QRCode.toString(text, { type: 'svg', margin: 1, width: size })
  return <span className={className} dangerouslySetInnerHTML={{ __html: svg }} />
}
