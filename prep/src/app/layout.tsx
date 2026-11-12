import type { Metadata, Viewport } from 'next'
import { Archivo } from 'next/font/google'
import { cookies } from 'next/headers'
import { hasDb } from '@/lib/db'
import { THEME_BG, THEME_COOKIE, parseTheme } from '@/lib/theme'
import { SwRegister } from '@/components/SwRegister'
import './globals.css'

const archivo = Archivo({ subsets: ['latin'], axes: ['wdth'], variable: '--font-archivo', display: 'swap' })

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: { default: 'Block 26', template: '%s – Block 26' },
  description: 'A 26-week, day-by-day interview prep plan with progress tracking and reminders.',
  applicationName: 'Block 26',
  appleWebApp: { capable: true, title: 'Block 26', statusBarStyle: 'default' },
  icons: { icon: '/icon.svg', apple: '/icons/apple-touch-icon.png' },
}

export async function generateViewport(): Promise<Viewport> {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value)
  return {
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
    themeColor:
      theme === 'system'
        ? [
            { media: '(prefers-color-scheme: light)', color: THEME_BG.light },
            { media: '(prefers-color-scheme: dark)', color: THEME_BG.dark },
          ]
        : THEME_BG[theme],
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value)
  return (
    <html lang="en" className={archivo.variable} data-theme={theme === 'system' ? undefined : theme} suppressHydrationWarning>
      <body>
        {hasDb() ? children : <SetupNeeded />}
        <SwRegister />
      </body>
    </html>
  )
}

function SetupNeeded() {
  return (
    <main className="shell">
      <h1 className="display">Connect MongoDB</h1>
      <p className="lede">
        Progress, logs and materials live in MongoDB. Add <code>MONGODB_URI</code> to <code>.env.local</code> (or your
        Vercel project settings) and reload. <code>.env.example</code> lists every setting.
      </p>
    </main>
  )
}
