'use client'
// 注册表单：客户端组件，用 useFormState 承接 registerAction 返回的错误信息。
import { useFormState } from 'react-dom'
import { registerAction } from '@/app/actions/auth'
import Eyebrow from '@/app/components/Eyebrow'
import Field from '@/app/components/Field'
import Money from '@/app/components/Money'
import SubmitButton from '@/app/components/SubmitButton'

/**
 * 注册表单：邮箱 + 密码（至少 8 位），role 由页面通过隐藏字段传入。
 * @param {{role: 'creator'|'reader', saasPriceCents: number}} props
 */
export default function RegisterForm({ role, saasPriceCents }) {
  const [state, formAction] = useFormState(registerAction, {})
  const creator = role === 'creator'

  return (
    <form action={formAction} className="panel">
      <Eyebrow>CREATE ACCOUNT</Eyebrow>
      <h1>创建{creator ? '创作者' : '读者'}账户</h1>
      {state?.error ? <p className="alert alert--error">{state.error}</p> : null}
      {creator ? (
        <p className="alert">
          <span>
            注册后需开通创作者套餐 <Money cents={saasPriceCents} />／月，才能发布商品和文章。
          </span>
        </p>
      ) : null}
      <input type="hidden" name="role" value={role} />
      <Field label="邮箱" name="email" type="email" placeholder="you@example.com" required />
      <Field
        label="密码"
        name="password"
        type="password"
        placeholder="至少 8 位"
        hint="密码至少 8 位"
        required
      />
      <SubmitButton>注册</SubmitButton>
      <p>
        <a href="/login">已有账户，去登录</a>
        {creator ? (
          <>
            {' · '}
            <a href="/register">注册读者账户</a>
          </>
        ) : (
          <>
            {' · '}
            <a href="/register?role=creator">注册创作者</a>
          </>
        )}
      </p>
    </form>
  )
}
