'use client'

import { useEffect, useState } from 'react'

const THEMES = [
  { key: 'light', label: '浅色' },
  { key: 'parchment', label: '羊皮纸' },
  { key: 'dark', label: '深色' },
]

const STORAGE_KEY = 'zhizhan-theme'

export default function ThemeToggle() {
  const [theme, setTheme] = useState('light')

  // 初次挂载时与 <html data-theme> 当前值对齐（防闪烁脚本已先行设置）
  useEffect(() => {
    const cur = document.documentElement.getAttribute('data-theme') || 'light'
    setTheme(cur)
  }, [])

  const apply = (key) => {
    document.documentElement.setAttribute('data-theme', key)
    try {
      localStorage.setItem(STORAGE_KEY, key)
    } catch {
      /* 隐私模式下 localStorage 不可用，忽略 */
    }
    setTheme(key)
  }

  return (
    <span className="themeToggle" role="group" aria-label="切换背景主题">
      {THEMES.map((t) => (
        <button
          key={t.key}
          type="button"
          aria-pressed={theme === t.key}
          aria-label={t.label}
          onClick={() => apply(t.key)}
        >
          {t.label}
        </button>
      ))}
    </span>
  )
}
