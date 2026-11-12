'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import type { Task } from '@/lib/plan'
import { trackName } from '@/lib/plan'
import { toggleTask, setRevisit } from '@/app/actions'
import { VideoEmbed } from './VideoEmbed'

const fmtMin = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`)

export function DayTasks({ n, tasks, initialDone, initialRevisit }: { n: number; tasks: Task[]; initialDone: string[]; initialRevisit: string[] }) {
  const [done, setDone] = useState(() => new Set(initialDone))
  const [flags, setFlags] = useState(() => new Set(initialRevisit))
  const [open, setOpen] = useState<string | null>(
    () => tasks.find((t) => t.kind === 'video' && !initialDone.includes(t.id))?.id ?? null,
  )
  const [error, setError] = useState('')
  const [, start] = useTransition()

  const req = tasks.filter((t) => !t.optional)
  const doneCount = req.filter((t) => done.has(t.id)).length
  const left = req.filter((t) => !done.has(t.id)).reduce((a, t) => a + t.mins, 0)
  const pct = req.length ? Math.round((doneCount / req.length) * 100) : 0

  function toggle(t: Task) {
    const next = !done.has(t.id)
    setDone((s) => {
      const c = new Set(s)
      if (next) c.add(t.id)
      else c.delete(t.id)
      return c
    })
    if (next && 'vibrate' in navigator) navigator.vibrate?.(12)
    setError('')
    start(async () => {
      try {
        const res = await toggleTask(n, t.id, next)
        setDone(new Set(res.done))
      } catch {
        setDone((s) => {
          const c = new Set(s)
          if (next) c.delete(t.id)
          else c.add(t.id)
          return c
        })
        setError("Couldn't save that. Check your connection and try again.")
      }
    })
  }

  function flag(t: Task) {
    if (!t.slug) return
    const on = !flags.has(t.slug)
    setFlags((s) => {
      const c = new Set(s)
      if (on) c.add(t.slug!)
      else c.delete(t.slug!)
      return c
    })
    start(async () => {
      try {
        await setRevisit(n, t.id, on)
      } catch {
        setError("Couldn't update your revisit list.")
      }
    })
  }

  return (
    <>
      <div className="meter" role="status">
        <span className="tnum">
          {doneCount} of {req.length} done
        </span>
        <span className="meter-track" aria-hidden="true">
          <i style={{ width: `${pct}%` }} />
        </span>
        <span className="tnum muted">{left ? `${fmtMin(left)} left` : 'Day complete'}</span>
      </div>
      {error && <p className="status error">{error}</p>}

      <ul className="tasks section" style={{ marginTop: 18, borderTop: '1px solid var(--line)' }}>
        {tasks.map((t) => {
          const isDone = done.has(t.id)
          const external = t.url?.startsWith('http')
          const title = t.url ? (
            external ? (
              <a className="task-title" href={t.url} target="_blank" rel="noreferrer">
                {t.title}
              </a>
            ) : (
              <Link className="task-title" href={t.url}>
                {t.title}
              </Link>
            )
          ) : (
            <span className="task-title">{t.title}</span>
          )
          return (
            <li key={t.id} className={`task${isDone ? ' is-done' : ''}`}>
              <div className="task-row">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={isDone}
                  aria-label={`Mark "${t.title}" as done`}
                  className="check"
                  onClick={() => toggle(t)}
                >
                  <span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="m5 12.5 4.5 4.5L19 7.5" />
                    </svg>
                  </span>
                </button>
                <div className="task-main">
                  {t.kind === 'video' ? (
                    <button
                      type="button"
                      className="task-title"
                      style={{ background: 'none', border: 0, padding: 0, textAlign: 'left', cursor: 'pointer' }}
                      onClick={() => setOpen(open === t.id ? null : t.id)}
                      aria-expanded={open === t.id}
                    >
                      {t.title}
                    </button>
                  ) : (
                    title
                  )}
                  <div className="task-meta">
                    <span className="track" data-t={t.track}>
                      {trackName(t.track)}
                    </span>
                    {t.difficulty && <span className={`diff-${t.difficulty}`}>{t.difficulty}</span>}
                    {t.kind === 'video' && t.channel && (
                      <span>
                        {t.channel}, {t.duration}
                      </span>
                    )}
                    {t.kind !== 'video' && <span className="tnum">{fmtMin(t.mins)}</span>}
                    {t.optional && <span>Optional</span>}
                  </div>
                  {t.note && <p className="task-note">{t.note}</p>}
                  {t.extra && (
                    <a className="extra-link" href={t.extra} target="_blank" rel="noreferrer">
                      Also read: {new URL(t.extra).hostname.replace(/^www\./, '')}
                    </a>
                  )}
                </div>
                <div className="task-side">
                  {t.kind === 'video' && (
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={open === t.id ? 'Hide video' : 'Watch here'}
                      aria-expanded={open === t.id}
                      onClick={() => setOpen(open === t.id ? null : t.id)}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
                        {open === t.id ? <path d="M6 15l6-6 6 6" strokeLinecap="round" /> : <path d="M8 5.5v13l10.5-6.5z" />}
                      </svg>
                    </button>
                  )}
                  {t.kind === 'problem' && t.slug && (
                    <button
                      type="button"
                      className="icon-btn"
                      aria-pressed={flags.has(t.slug)}
                      aria-label={flags.has(t.slug) ? 'Remove from revisit list' : 'Add to revisit list'}
                      title={flags.has(t.slug) ? 'On your revisit list' : 'Revisit later'}
                      onClick={() => flag(t)}
                    >
                      <svg viewBox="0 0 24 24" fill={flags.has(t.slug) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
                        <path d="M6 4h12v16l-6-4-6 4z" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
              {t.kind === 'video' && open === t.id && t.videoId && (
                <VideoEmbed id={t.videoId} title={t.videoTitle ?? t.title} channel={t.channel} duration={t.duration} />
              )}
            </li>
          )
        })}
      </ul>
    </>
  )
}
