'use client'

import { useActionState } from 'react'
import { signIn } from '@/app/actions'

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, null)
  return (
    <form action={action}>
      <label className="field">
        <span>Passcode</span>
        <input className="input" name="passcode" type="password" autoComplete="current-password" required autoFocus />
      </label>
      <div className="row" style={{ marginTop: 14 }}>
        <button className="btn" disabled={pending}>
          {pending ? 'Opening…' : 'Open my plan'}
        </button>
        <span className="status error" role="status">
          {state?.error}
        </span>
      </div>
    </form>
  )
}
