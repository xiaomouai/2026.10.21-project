import { Suspense } from 'react'
import AuthForm from '../AuthForm'
export default function RegisterPage() { return <main className="auth-page"><Suspense><AuthForm mode="register"/></Suspense></main> }
