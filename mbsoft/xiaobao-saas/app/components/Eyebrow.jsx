/** 小标签：全站统一的眉标题文字，如 CREATOR CONSOLE */
export default function Eyebrow({ children, className }) {
  return <span className={className ? `eyebrow ${className}` : 'eyebrow'}>{children}</span>
}
