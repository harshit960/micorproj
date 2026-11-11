import type { Metadata, Viewport } from 'next'
import { Archivo } from 'next/font/google'
import { hasDb } from '@/lib/db'
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

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f3f5f8' },
    { media: '(prefers-color-scheme: dark)', color: '#0e1420' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={archivo.variable}>
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
