const VARIANTS = {
  primary: 'primary',
  secondary: 'secondary',
  wechat: 'wechat',
}

/**
 * 提交按钮：variant 支持 primary / secondary / wechat，默认 primary。
 * name/value 可选：同表单多个提交按钮时，点击哪个就提交对应的键值（如 status=draft）。
 */
export default function SubmitButton({ children, variant, className, name, value, disabled }) {
  const base = VARIANTS[variant] || 'primary'

  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={disabled}
      className={className ? `${base} ${className}` : base}
    >
      {children}
    </button>
  )
}
