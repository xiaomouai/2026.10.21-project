// 登录页：Server Component，负责外套 .auth 布局并渲染客户端表单。
import LoginForm from './LoginForm'

export const metadata = { title: '登录｜知栈' }

/** 登录页，表单交互与错误展示交给 LoginForm */
export default function Page() {
  return (
    <main className="auth">
      <LoginForm />
    </main>
  )
}
