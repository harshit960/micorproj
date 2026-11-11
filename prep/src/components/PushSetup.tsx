'use client'

import { useEffect, useState, useTransition } from 'react'
import { savePushSubscription, removePushSubscription, sendTestNotification } from '@/app/actions'

const KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

function b64ToBytes(b64: string) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (ch) => ch.charCodeAt(0))
}

type State = 'loading' | 'unsupported' | 'ios-install' | 'denied' | 'off' | 'on'

export function PushSetup() {
  const [state, setState] = useState<State>('loading')
  const [msg, setMsg] = useState<{ text: string; error?: boolean }>({ text: '' })
  const [pending, start] = useTransition()

  useEffect(() => {
    ;(async () => {
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
      const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        setState(ios && !standalone ? 'ios-install' : 'unsupported')
        return
      }
      if (Notification.permission === 'denied') return setState('denied')
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
      const sub = await reg.pushManager.getSubscription()
      setState(sub ? 'on' : 'off')
    })().catch(() => setState('unsupported'))
  }, [])

  function enable() {
    start(async () => {
      try {
        if (!KEY) throw new Error('Push keys are missing on the server. Set NEXT_PUBLIC_VAPID_PUBLIC_KEY and redeploy.')
        const perm = await Notification.requestPermission()
        if (perm !== 'granted') {
          setState(perm === 'denied' ? 'denied' : 'off')
          return
        }
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(KEY) })
        await savePushSubscription(JSON.parse(JSON.stringify(sub)), navigator.userAgent)
        setState('on')
        setMsg({ text: 'Reminders are on for this device.' })
      } catch (e) {
        setMsg({ text: (e as Error).message || "Couldn't turn on reminders.", error: true })
      }
    })
  }

  function disable() {
    start(async () => {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await removePushSubscription(sub.endpoint)
        await sub.unsubscribe()
      }
      setState('off')
      setMsg({ text: 'Reminders are off for this device.' })
    })
  }

  function test() {
    start(async () => {
      const r = await sendTestNotification()
      setMsg(
        r.sent
          ? { text: `Sent to ${r.sent} ${r.sent === 1 ? 'device' : 'devices'}.` }
          : { text: 'Nothing was delivered. Turn reminders off and on again on this device.', error: true },
      )
    })
  }

  return (
    <div>
      {state === 'loading' && <p className="status">Checking this device…</p>}
      {state === 'unsupported' && <p className="small muted">This browser can&apos;t receive push notifications.</p>}
      {state === 'ios-install' && (
        <p className="small">
          On iPhone, reminders need the app on your home screen: tap Share, then Add to Home Screen, then open Block 26
          from there and come back to this page.
        </p>
      )}
      {state === 'denied' && (
        <p className="small">Notifications are blocked for this site. Allow them in your browser&apos;s site settings, then reload.</p>
      )}
      {(state === 'off' || state === 'on') && (
        <div className="row">
          {state === 'off' ? (
            <button type="button" className="btn" onClick={enable} disabled={pending}>
              Turn on reminders
            </button>
          ) : (
            <>
              <button type="button" className="btn ghost" onClick={test} disabled={pending}>
                Send a test
              </button>
              <button type="button" className="btn quiet" onClick={disable} disabled={pending}>
                Turn off on this device
              </button>
            </>
          )}
        </div>
      )}
      <p className={`status${msg.error ? ' error' : ''}`} role="status" style={{ marginTop: 8 }}>
        {msg.text}
      </p>
    </div>
  )
}
