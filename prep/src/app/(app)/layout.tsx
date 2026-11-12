import Link from 'next/link'
import { Nav } from '@/components/Nav'
import { ThemeToggle } from '@/components/ThemeToggle'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main className="shell">
        <div className="topbar">
          <Link href="/" className="brand">
            Block 26
          </Link>
          <ThemeToggle />
        </div>
        {children}
      </main>
      <Nav />
    </>
  )
}
