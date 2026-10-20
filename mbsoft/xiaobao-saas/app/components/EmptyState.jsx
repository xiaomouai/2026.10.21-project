/** 空状态：列表无数据时展示标题、说明与可选跳转按钮 */
export default function EmptyState({ title, description, actionHref, actionLabel, children }) {
  return (
    <div className="empty">
      {title ? <h3>{title}</h3> : null}
      {description ? <p>{description}</p> : null}
      {children}
      {actionHref && actionLabel ? (
        <a className="primary" href={actionHref}>
          {actionLabel}
        </a>
      ) : null}
    </div>
  )
}
