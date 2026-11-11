'use client'

import { useState, useTransition } from 'react'
import { saveLog } from '@/app/actions'

export function DayLog({ n, minutes, note }: { n: number; minutes: number; note: string }) {
  const [m, setM] = useState(minutes)
  const [text, setText] = useState(note)
  const [status, setStatus] = useState<{ msg: string; error?: boolean }>({ msg: '' })
  const [pending, start] = useTransition()
  const dirty = m !== minutes || text !== note

  const step = (d: number) => setM((v) => Math.max(0, Math.min(960, v + d)))

  return (
    <form
      className="section"
      onSubmit={(e) => {
        e.preventDefault()
        start(async () => {
          try {
            await saveLog(n, m, text)
            setStatus({ msg: 'Log saved.' })
          } catch {
            setStatus({ msg: "Couldn't save the log. Try again.", error: true })
          }
        })
      }}
    >
      <div className="section-head">
        <h2 className="h2">Log</h2>
        <span className="small muted">Counts toward your streak</span>
      </div>
      <div className="field">
        <span id={`min-${n}`}>Minutes studied</span>
        <div className="stepper" role="group" aria-labelledby={`min-${n}`}>
          <button type="button" onClick={() => step(-15)} aria-label="15 minutes less">
            −
          </button>
          <input
            inputMode="numeric"
            value={m}
            onChange={(e) => setM(Math.max(0, Math.min(960, Number(e.target.value.replace(/\D/g, '')) || 0)))}
            aria-labelledby={`min-${n}`}
          />
          <button type="button" onClick={() => step(15)} aria-label="15 minutes more">
            +
          </button>
        </div>
      </div>
      <label className="field">
        <span>Notes</span>
        <textarea
          className="input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What clicked, where you got stuck, what to revisit."
          maxLength={4000}
        />
      </label>
      <div className="row" style={{ marginTop: 14 }}>
        <button className="btn" disabled={pending || !dirty}>
          {pending ? 'Saving…' : 'Save log'}
        </button>
        <span className={`status${status.error ? ' error' : ''}`} role="status">
          {status.msg}
        </span>
      </div>
    </form>
  )
}
