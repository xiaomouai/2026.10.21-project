/** 白底卡片容器：可选标题与底部操作区，控制台与设置页复用 */
export default function Panel({ title, children, footer, className }) {
  return (
    <section className={className ? `panel ${className}` : 'panel'}>
      {title ? <h2 className="panelTitle">{title}</h2> : null}
      {children}
      {footer ? <div className="panelFoot">{footer}</div> : null}
    </section>
  )
}
