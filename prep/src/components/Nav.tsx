'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const items = [
  { href: '/', label: 'Today', d: 'M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z' },
  { href: '/plan', label: 'Plan', d: 'M4 20V10m5 10V6m5 14v-8m5 8V4' },
  { href: '/progress', label: 'Progress', d: 'M4 19h16M6 15l4-5 4 3 5-7' },
  { href: '/library', label: 'Library', d: 'M5 4h4v16H5zM11 4h4v16h-4zM16.5 5.5l3.5-1 3 15-3.5 1z' },
  { href: '/settings', label: 'Settings', d: 'M4 7h10m4 0h2M4 17h4m4 0h8M14 5v4M8 15v4' },
]

export function Nav() {
  const path = usePathname()
  const active = (href: string) => (href === '/' ? path === '/' || path.startsWith('/day/') : path.startsWith(href))
  return (
    <nav className="nav" aria-label="Main">
      {items.map((it) => (
        <Link key={it.href} href={it.href} aria-current={active(it.href) ? 'page' : undefined}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={it.d} />
          </svg>
          {it.label}
        </Link>
      ))}
    </nav>
  )
}
