// 注册页：按 searchParams.role 区分创作者 / 读者注册，具体表单交给客户端组件。
import { SAAS_PRICE_CENTS } from '@/lib'
import RegisterForm from './RegisterForm'

export const metadata = { title: '注册｜知栈' }

/**
 * 注册页，role=creator 时走创作者注册流程。
 * @param {{searchParams: {role?: string}}} props
 */
export default function Page({ searchParams }) {
  const role = searchParams.role === 'creator' ? 'creator' : 'reader'

  return (
    <main className="auth">
      <RegisterForm role={role} saasPriceCents={SAAS_PRICE_CENTS} />
    </main>
  )
}
