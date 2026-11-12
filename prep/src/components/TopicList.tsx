'use client'

import Link from 'next/link'
import { useMemo, useState, useTransition } from 'react'
import type { Task } from '@/lib/plan'
import { toggleTask } from '@/app/actions'
import { VideoEmbed } from './VideoEmbed'

export interface TopicItem {
  task: Task
  day: number
  week: number
  weekTheme: string
  dateLabel: string
  done: boolean
}

const fmtMin = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`)

/** Every task of one track across the plan, so you can study by mood instead of by date. */
export function TopicList({ items, trackName }: { items: TopicItem[]; trackName: string }) {
  const [done, setDone] = useState(() => new Set(items.filter((i) => i.done).map((i) => i.task.id)))
  const [hideDone, setHideDone] = useState(true)
  const [open, setOpen] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [, start] = useTransition()

  const doneCount = items.filter((i) => done.has(i.task.id)).length
  const next = items.find((i) => !done.has(i.task.id))
  const visible = hideDone ? items.filter((i) => !done.has(i.task.id)) : items

  const weeks = useMemo(() => {
    const m = new Map<number, { rows: TopicItem[] }>()
    for (const it of visible) {
      const w = m.get(it.week) ?? { rows: [] }
      w.rows.push(it)
      m.set(it.week, w)
    }
    return [...m.entries()]
  }, [visible])

  function toggle(it: TopicItem) {
    const on = !done.has(it.task.id)
    const flip = (s: Set<string>, add: boolean) => {
      const c = new Set(s)
      if (add) c.add(it.task.id)
      else c.delete(it.task.id)
      return c
    }
    setDone((s) => flip(s, on))
    setError('')
    start(async () => {
      try {
        await toggleTask(it.day, it.task.id, on)
      } catch {
        setDone((s) => flip(s, !on))
        setError("Couldn't save that. Check your connection and try again.")
      }
    })
  }

  return (
    <>
      <div className="meter" role="status">
        <span className="tnum">
          {doneCount} of {items.length} {trackName} tasks done
        </span>
        <span className="meter-track" aria-hidden="true">
          <i style={{ width: `${items.length ? (doneCount / items.length) * 100 : 0}%` }} />
        </span>
      </div>
      <div className="row" style={{ marginTop: 14, justifyContent: 'space-between' }}>
        <span className="small muted">
          {next ? (
            <>
              Next up from day {next.day}: <b style={{ color: 'var(--ink)' }}>{next.task.title}</b>
            </>
          ) : (
            'Everything in this track is done.'
          )}
        </span>
        <label className="row small" style={{ gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} />
          Hide done
        </label>
      </div>
      {error && <p className="status error">{error}</p>}

      {weeks.map(([w, { rows }]) => (
        <section key={w} className="section" style={{ marginTop: 24 }}>
          <div className="section-head">
            <h2 className="h2 small" style={{ fontSize: 16 }}>
              Week {w}
            </h2>
            <span className="small muted tnum">
              {rows.length} {rows.length === 1 ? 'task' : 'tasks'}
            </span>
          </div>
          <ul className="tasks">
            {rows.map((it) => {
              const t = it.task
              const isDone = done.has(t.id)
              const isOpen = open === t.id
              return (
                <li key={t.id} className={`task${isDone ? ' is-done' : ''}`}>
                  <div className="task-row">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={isDone}
                      aria-label={`Mark "${t.title}" as done`}
                      className="check"
                      onClick={() => toggle(it)}
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
                          onClick={() => setOpen(isOpen ? null : t.id)}
                          aria-expanded={isOpen}
                        >
                          {t.title}
                        </button>
                      ) : t.url?.startsWith('http') ? (
                        <a className="task-title" href={t.url} target="_blank" rel="noreferrer">
                          {t.title}
                        </a>
                      ) : (
                        <span className="task-title">{t.title}</span>
                      )}
                      <div className="task-meta">
                        <Link href={`/day/${it.day}`} className="tnum">
                          Day {it.day}, {it.dateLabel}
                        </Link>
                        {t.difficulty && <span className={`diff-${t.difficulty}`}>{t.difficulty}</span>}
                        {t.kind === 'video' ? (
                          <span>
                            {t.channel}, {t.duration}
                          </span>
                        ) : (
                          <span className="tnum">{fmtMin(t.mins)}</span>
                        )}
                      </div>
                      {t.note && <p className="task-note">{t.note}</p>}
                    </div>
                    <div className="task-side">
                      {t.kind === 'video' && (
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={isOpen ? 'Hide video' : 'Watch here'}
                          aria-expanded={isOpen}
                          onClick={() => setOpen(isOpen ? null : t.id)}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
                            {isOpen ? <path d="M6 15l6-6 6 6" strokeLinecap="round" /> : <path d="M8 5.5v13l10.5-6.5z" />}
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                  {t.kind === 'video' && isOpen && t.videoId && (
                    <VideoEmbed id={t.videoId} title={t.videoTitle ?? t.title} channel={t.channel} duration={t.duration} />
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      ))}
      {!visible.length && <p className="empty">Nothing left here. Turn off Hide done to see what you finished.</p>}
    </>
  )
}
