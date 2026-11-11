import type { Metadata } from 'next'
import { LoginForm } from './LoginForm'

export const metadata: Metadata = { title: 'Sign in' }

export default function LoginPage() {
  return (
    <main className="shell login">
      <h1 className="display">Block 26</h1>
      <p className="lede">Six months, one day at a time. Enter your passcode to open your plan.</p>
      <LoginForm />
    </main>
  )
}
