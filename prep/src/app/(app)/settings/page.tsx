import type { Metadata } from 'next'
import { getSettings, clock } from '@/lib/store'
import { authEnabled } from '@/lib/auth'
import { vapidPublicKey } from '@/lib/push'
import { shiftPlan, signOut } from '@/app/actions'
import { fmtDate } from '@/lib/time'
import { SettingsForm } from '@/components/SettingsForm'
import { PushSetup } from '@/components/PushSetup'
import { InstallButton } from '@/components/InstallButton'
import { ThemeSetting } from '@/components/ThemeToggle'

export const metadata: Metadata = { title: 'Settings' }

export default async function SettingsPage() {
  const s = await getSettings()
  const c = clock(s)
  return (
    <>
      <h1 className="display">Settings</h1>
      <p className="lede">
        {c.started ? `You're on day ${c.todayN}.` : `Day 1 is ${fmtDate(s.startDate, { weekday: 'long', day: 'numeric', month: 'long' })}.`}
      </p>

      <section className="section">
        <div className="section-head">
          <h2 className="h2">Appearance</h2>
        </div>
        <div style={{ marginTop: 14 }}>
          <ThemeSetting />
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="h2">Reminders</h2>
        </div>
        <div style={{ marginTop: 14 }}>
          <PushSetup publicKey={await vapidPublicKey()} />
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="h2">Plan and schedule</h2>
        </div>
        <SettingsForm
          startDate={s.startDate}
          tz={s.tz}
          leetcode={s.leetcode}
          morning={s.reminders.morning}
          evening={s.reminders.evening}
        />
        <div className="row" style={{ marginTop: 20 }}>
          <form action={shiftPlan.bind(null, 1)}>
            <button className="btn ghost">Push plan back a week</button>
          </form>
          <form action={shiftPlan.bind(null, -1)}>
            <button className="btn quiet">Pull it forward a week</button>
          </form>
        </div>
        <p className="hint" style={{ marginTop: 8 }}>
          Moving the plan keeps everything you&apos;ve checked off. Only the dates change.
        </p>
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="h2">App</h2>
        </div>
        <div style={{ marginTop: 14 }}>
          <InstallButton />
        </div>
        {authEnabled() ? (
          <form action={signOut} style={{ marginTop: 14 }}>
            <button className="btn danger">Sign out</button>
          </form>
        ) : (
          <p className="small" style={{ marginTop: 14, color: 'var(--danger)' }}>
            No passcode is set, so anyone with the link can open this app. Set APP_PASSCODE before you deploy.
          </p>
        )}
      </section>
    </>
  )
}
