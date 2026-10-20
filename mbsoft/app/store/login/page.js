import { Suspense } from 'react'
import AuthForm from '../AuthForm'
export default function LoginPage() { return <main className="auth-page"><Suspense><AuthForm mode="login"/></Suspense></main> }
