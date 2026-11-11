import type { Metadata } from 'next'
import { LoginForm } from './LoginForm'
import { passcodeSet } from '@/lib/auth'

export const metadata: Metadata = { title: 'Sign in' }

export const dynamic = 'force-dynamic'

export default function LoginPage() {
  return (
    <main className="shell login">
      <h1 className="display">Block 26</h1>
      <p className="lede">Six months, one day at a time. Enter your passcode to open your plan.</p>
      {passcodeSet() ? (
        <LoginForm />
      ) : (
        <p className="banner">
          No passcode is set, so sign-in is locked. Add APP_PASSCODE in your Vercel project&apos;s environment variables and
          redeploy.
        </p>
      )}
    </main>
  )
}
