'use client'

import { useEffect, useState } from 'react'

interface BIPEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

export function InstallButton() {
  const [evt, setEvt] = useState<BIPEvent | null>(null)
  const [installed, setInstalled] = useState(false)
  useEffect(() => {
    setInstalled(window.matchMedia('(display-mode: standalone)').matches)
    const on = (e: Event) => {
      e.preventDefault()
      setEvt(e as BIPEvent)
    }
    window.addEventListener('beforeinstallprompt', on)
    window.addEventListener('appinstalled', () => setInstalled(true))
    return () => window.removeEventListener('beforeinstallprompt', on)
  }, [])
  if (installed) return <p className="small muted">Installed on this device.</p>
  if (!evt) return <p className="small muted">Use your browser menu: Install app, or Add to Home Screen.</p>
  return (
    <button
      type="button"
      className="btn ghost"
      onClick={async () => {
        await evt.prompt()
        setEvt(null)
      }}
    >
      Install Block 26
    </button>
  )
}
