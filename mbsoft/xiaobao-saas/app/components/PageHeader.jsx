import Eyebrow from './Eyebrow'

/** 页面标题区：眉标题 + 大标题 + 描述，children 渲染在右侧动作区 */
export default function PageHeader({ eyebrow, title, description, children }) {
  return (
    <section className="pageHead">
      <div>
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {children ? <div>{children}</div> : null}
    </section>
  )
}
