'use client'

import { useActionState } from 'react'
import { saveSettings } from '@/app/actions'

const hours = Array.from({ length: 24 }, (_, h) => h)
const label = (h: number) => `${String(h).padStart(2, '0')}:00`

export function SettingsForm(props: { startDate: string; tz: string; leetcode: string; morning: number; evening: number }) {
  const [state, action, pending] = useActionState(saveSettings, null)
  return (
    <form action={action}>
      <label className="field">
        <span>Plan start</span>
        <input className="input" type="date" name="startDate" defaultValue={props.startDate} required />
        <span className="hint">Day 1 is always a Monday. Other dates snap back to that week&apos;s Monday.</span>
      </label>
      <div className="grid-2">
        <label className="field">
          <span>Morning plan</span>
          <select className="input" name="morning" defaultValue={props.morning}>
            {hours.map((h) => (
              <option key={h} value={h}>
                {label(h)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Evening nudge</span>
          <select className="input" name="evening" defaultValue={props.evening}>
            {hours.map((h) => (
              <option key={h} value={h}>
                {label(h)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="hint" style={{ marginTop: 8 }}>
        The evening nudge only goes out if today isn&apos;t finished. The built-in Vercel schedule runs at 08:00 and 21:00
        India time; for other times, turn on the hourly GitHub workflow described in the README.
      </p>
      <div className="grid-2">
        <label className="field">
          <span>LeetCode username</span>
          <input className="input" name="leetcode" defaultValue={props.leetcode} autoCapitalize="off" autoCorrect="off" />
        </label>
        <label className="field">
          <span>Time zone</span>
          <input className="input" name="tz" defaultValue={props.tz} autoCapitalize="off" autoCorrect="off" />
        </label>
      </div>
      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn" disabled={pending}>
          {pending ? 'Saving…' : 'Save settings'}
        </button>
        <span className={`status${state && 'error' in state ? ' error' : ''}`} role="status">
          {state && ('error' in state ? state.error : state.ok)}
        </span>
      </div>
    </form>
  )
}
