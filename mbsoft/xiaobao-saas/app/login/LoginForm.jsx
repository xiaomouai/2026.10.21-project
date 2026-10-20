'use client'
// 登录表单：客户端组件，用 useFormState 承接 loginAction 返回的错误信息。
import { useFormState } from 'react-dom'
import { loginAction } from '@/app/actions/auth'
import Eyebrow from '@/app/components/Eyebrow'
import Field from '@/app/components/Field'
import SubmitButton from '@/app/components/SubmitButton'

/** 登录表单：邮箱 + 密码，提交后由服务端按角色跳转 */
export default function LoginForm() {
  const [state, formAction] = useFormState(loginAction, {})

  return (
    <form action={formAction} className="panel">
      <Eyebrow>WELCOME BACK</Eyebrow>
      <h1>登录知栈</h1>
      {state?.error ? <p className="alert alert--error">{state.error}</p> : null}
      <Field label="邮箱" name="email" type="email" placeholder="you@example.com" required />
      <Field label="密码" name="password" type="password" placeholder="请输入密码" required />
      <SubmitButton>登录</SubmitButton>
      <p>
        <a href="/register">注册读者账户</a> · <a href="/register?role=creator">注册创作者</a>
      </p>
      <p className="meta">
        演示账号：创作者 demo@creator.local / demo12345；管理员首次登录需预先设置 ADMIN_PASSWORD
      </p>
    </form>
  )
}
