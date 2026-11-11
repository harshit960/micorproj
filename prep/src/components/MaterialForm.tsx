'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { TRACKS, TOTAL_DAYS } from '@/lib/plan'

export function MaterialForm({ defaultDay, defaultOpen }: { defaultDay?: number; defaultOpen: boolean }) {
  const router = useRouter()
  const form = useRef<HTMLFormElement>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{ msg: string; error?: boolean }>({ msg: '' })

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setStatus({ msg: '' })
    try {
      const res = await fetch('/api/materials', { method: 'POST', body: new FormData(e.currentTarget) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Upload failed. Try again.')
      form.current?.reset()
      setStatus({ msg: 'Saved to your library.' })
      router.refresh()
    } catch (err) {
      setStatus({ msg: (err as Error).message, error: true })
    } finally {
      setBusy(false)
    }
  }

  return (
    <details className="panel add" id="add" open={defaultOpen}>
      <summary className="h2">Add material</summary>
      <form ref={form} onSubmit={onSubmit}>
        <label className="field">
          <span>Title</span>
          <input className="input" name="title" maxLength={200} placeholder="Graph patterns cheat sheet" />
        </label>
        <label className="field">
          <span>Link</span>
          <input className="input" name="url" type="url" inputMode="url" placeholder="https://drive.google.com/…" />
        </label>
        <label className="field">
          <span>Or a file</span>
          <input className="input" name="file" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.md" />
          <span className="hint">PDF, image or text, up to 4 MB. Stored in MongoDB.</span>
        </label>
        <div className="grid-2">
          <label className="field">
            <span>Track</span>
            <select className="input" name="track" defaultValue="dsa">
              {TRACKS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Day (optional)</span>
            <input className="input" name="day" type="number" min={1} max={TOTAL_DAYS} defaultValue={defaultDay} inputMode="numeric" />
          </label>
        </div>
        <label className="field">
          <span>Note</span>
          <textarea className="input" name="note" maxLength={2000} placeholder="Why this is worth keeping." />
        </label>
        <div className="row" style={{ marginTop: 14 }}>
          <button className="btn" disabled={busy}>
            {busy ? 'Saving…' : 'Save to library'}
          </button>
          <span className={`status${status.error ? ' error' : ''}`} role="status">
            {status.msg}
          </span>
        </div>
      </form>
    </details>
  )
}
