import { fmt, yuan } from '@/lib/money'

/** 金额展示：默认渲染「¥99.00」，传 plain 时只渲染数字「99」 */
export default function Money({ cents, plain, className }) {
  // lib/money 由另一模块提供，这里统一剥掉货币符号再按需要补回
  const digits = String((plain ? yuan(cents) : fmt(cents)) ?? '').replace(/[^\d.-]/g, '')
  const text = plain ? digits.replace(/\.0+$/, '') : `¥${digits}`

  return <span className={className}>{text}</span>
}
