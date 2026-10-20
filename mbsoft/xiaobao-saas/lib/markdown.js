// 轻量 Markdown 渲染器：零依赖纯函数，客户端（编辑器实时预览）与服务端（阅读页）共用。
// 安全策略：先把原始文本整体做 HTML 转义，再做语法替换，因此任何注入的标签都会变成可见文本；
// 链接只放行 http/https/站内相对路径，其余协议（javascript: 等）一律降级为纯文本。

/** HTML 螺栓转义：& < > " ' */
const escapeHtml = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

/** 链接地址白名单：http(s) 与站内相对路径 */
const safeHref = (href) => /^(https?:\/\/|\/)/i.test(href || '')

/**
 * 行内语法：`code`、**粗体**、*斜体*、[文字](地址)。
 * 输入已完成 HTML 转义，这里只做安全的语法替换。
 * @param {string} text 已转义的行文本
 * @returns {string} HTML 片段
 */
function inline(text) {
  let out = text
  out = out.replace(/`([^`]+)`/g, (_, code) => `<code>${code}</code>`)
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, href) =>
    safeHref(href) ? `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>` : m,
  )
  return out
}

/** 判断一行是否为有序/无序列表项，返回 {type, text} 或 null */
const listItem = (line) => {
  const m = line.match(/^\s*(?:[-*]|\d+\.)\s+(.*)$/)
  return m ? { text: m[1] } : null
}

/**
 * 渲染 Markdown 为 HTML 字符串。
 * 支持：#~###### 标题、段落、**粗体**、*斜体*、`行内代码`、``` 围栏代码块、
 * > 引用、- / * 无序列表、1. 有序列表、--- 分隔线、[链接](地址)。
 * @param {string} markdown 原始 markdown 文本
 * @returns {string} 已转义、可安全注入 innerHTML 的 HTML
 */
export function renderMarkdown(markdown) {
  const lines = String(markdown || '').replace(/\r\n?/g, '\n').split('\n')
  const html = []
  let para = []
  let list = null // null | 'ul' | 'ol'
  let quote = []
  let fence = null

  const flushPara = () => {
    if (para.length) {
      html.push(`<p>${inline(escapeHtml(para.join(' ')))}</p>`)
      para = []
    }
  }
  const flushList = () => {
    if (list) {
      html.push(`<${list}>${items.map((t) => `<li>${inline(escapeHtml(t))}</li>`).join('')}</${list}>`)
      list = null
      items = []
    }
  }
  const flushQuote = () => {
    if (quote.length) {
      html.push(`<blockquote><p>${inline(escapeHtml(quote.join(' ')))}</p></blockquote>`)
      quote = []
    }
  }
  let items = []

  for (const raw of lines) {
    // 围栏代码块优先于一切块级语法
    if (fence !== null) {
      if (/^```/.test(raw.trim())) {
        html.push(`<pre><code>${fence.join('\n')}</code></pre>`)
        fence = null
      } else {
        fence.push(raw)
      }
      continue
    }
    if (/^```/.test(raw.trim())) {
      flushPara(); flushList(); flushQuote()
      fence = []
      continue
    }

    const line = raw.trimEnd()

    if (!line.trim()) {
      flushPara(); flushList(); flushQuote()
      continue
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/)
    if (heading) {
      flushPara(); flushList(); flushQuote()
      const level = heading[1].length
      html.push(`<h${level}>${inline(escapeHtml(heading[2]))}</h${level}>`)
      continue
    }

    if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      flushPara(); flushList(); flushQuote()
      html.push('<hr />')
      continue
    }

    if (line.startsWith('&gt;') || line.startsWith('>')) {
      flushPara(); flushList()
      quote.push(line.replace(/^>\s?/, ''))
      continue
    }

    const item = listItem(line)
    if (item) {
      flushPara(); flushQuote()
      const ordered = /^\s*\d+\./.test(line)
      if (list && list !== (ordered ? 'ol' : 'ul')) flushList()
      list = ordered ? 'ol' : 'ul'
      items.push(item.text)
      continue
    }

    // 普通文本行：先结束列表/引用，再累积段落
    flushList(); flushQuote()
    para.push(line.trim())
  }

  // 收尾
  if (fence !== null) html.push(`<pre><code>${fence.join('\n')}</code></pre>`)
  flushPara(); flushList(); flushQuote()

  return html.join('\n')
}

/**
 * 从 markdown 提取纯文本摘要：剥掉语法标记、压缩空白、按字数截断。
 * 用于分享卡片与列表预览。
 * @param {string} markdown
 * @param {number} [max=160] 最大字符数
 * @returns {string}
 */
export function excerptOf(markdown, max = 160) {
  const plain = String(markdown || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/[*_`~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return plain.length > max ? plain.slice(0, max).replace(/\s?\S*$/, '') + '…' : plain
}
