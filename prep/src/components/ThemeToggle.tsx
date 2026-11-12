'use client'

import { useEffect, useState } from 'react'
import { THEME_BG, THEME_COOKIE, type Theme } from '@/lib/theme'

function apply(theme: Theme) {
  const root = document.documentElement
  if (theme === 'system') delete root.dataset.theme
  else root.dataset.theme = theme
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=31536000; samesite=lax`
  const dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', dark ? THEME_BG.dark : THEME_BG.light))
  window.dispatchEvent(new CustomEvent('b26-theme', { detail: theme }))
}

function current(): Theme {
  const t = document.documentElement.dataset.theme
  return t === 'light' || t === 'dark' ? t : 'system'
}

function useTheme() {
  const [theme, setTheme] = useState<Theme>('system')
  const [systemDark, setSystemDark] = useState(false)
  useEffect(() => {
    setTheme(current())
    const mq = matchMedia('(prefers-color-scheme: dark)')
    setSystemDark(mq.matches)
    const onMq = () => setSystemDark(mq.matches)
    const onTheme = (e: Event) => setTheme((e as CustomEvent<Theme>).detail)
    mq.addEventListener('change', onMq)
    window.addEventListener('b26-theme', onTheme)
    return () => {
      mq.removeEventListener('change', onMq)
      window.removeEventListener('b26-theme', onTheme)
    }
  }, [])
  const isDark = theme === 'dark' || (theme === 'system' && systemDark)
  return { theme, isDark, set: (t: Theme) => apply(t) }
}

/** One-tap switch between light and dark. */
export function ThemeToggle() {
  const { isDark, set } = useTheme()
  return (
    <button
      type="button"
      className="icon-btn theme-toggle"
      onClick={() => set(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
        {isDark ? (
          <>
            <circle cx="12" cy="12" r="4.2" />
            <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
          </>
        ) : (
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" strokeLinejoin="round" />
        )}
      </svg>
    </button>
  )
}

/** System / Light / Dark, for Settings. */
export function ThemeSetting() {
  const { theme, set } = useTheme()
  const opts: { id: Theme; label: string }[] = [
    { id: 'system', label: 'System' },
    { id: 'light', label: 'Light' },
    { id: 'dark', label: 'Dark' },
  ]
  return (
    <div className="segmented" role="radiogroup" aria-label="Appearance">
      {opts.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={theme === o.id} onClick={() => set(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
