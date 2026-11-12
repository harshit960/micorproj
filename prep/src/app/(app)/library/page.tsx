import Link from 'next/link'
import type { Metadata } from 'next'
import { cols } from '@/lib/db'
import { TRACKS, TOTAL_DAYS, trackName, type Track } from '@/lib/plan'
import { deleteMaterial } from '@/app/actions'
import { MaterialForm } from '@/components/MaterialForm'

export const metadata: Metadata = { title: 'Library' }

const SHELF: { title: string; url: string; track: Track; why: string }[] = [
  { title: "Striver's A2Z DSA sheet", url: 'https://takeuforward.org/strivers-a2z-dsa-course/strivers-a2z-dsa-course-sheet-2', track: 'dsa', why: 'Topic-by-topic problems with video solutions.' },
  { title: 'NeetCode roadmap', url: 'https://neetcode.io/roadmap', track: 'dsa', why: 'The 150 core problems as a dependency graph.' },
  { title: 'CP-Algorithms', url: 'https://cp-algorithms.com/', track: 'dsa', why: 'Reference for segment trees, Dijkstra variants, string algorithms.' },
  { title: 'Refactoring.Guru design patterns', url: 'https://refactoring.guru/design-patterns', track: 'lld', why: 'Every GoF pattern with diagrams and code.' },
  { title: 'Awesome low-level design', url: 'https://github.com/ashishps1/awesome-low-level-design', track: 'lld', why: 'Machine coding problems with solutions.' },
  { title: 'Hello Interview: system design in a hurry', url: 'https://www.hellointerview.com/learn/system-design/in-a-hurry/introduction', track: 'hld', why: 'The delivery framework and core concepts.' },
  { title: 'System Design Primer', url: 'https://github.com/donnemartin/system-design-primer', track: 'hld', why: 'Building blocks and classic case studies.' },
  { title: 'ByteByteGo blog', url: 'https://blog.bytebytego.com/', track: 'hld', why: 'Short visual explainers.' },
  { title: 'OSTEP (free OS textbook)', url: 'https://pages.cs.wisc.edu/~remzi/OSTEP/', track: 'cs', why: 'Read the chapters behind the OS videos.' },
  { title: 'Tech Interview Handbook', url: 'https://www.techinterviewhandbook.org/', track: 'career', why: 'Resume, behavioral and negotiation guides.' },
]

export default async function LibraryPage(props: PageProps<'/library'>) {
  const sp = await props.searchParams
  const track = TRACKS.some((t) => t.id === sp.track) ? (sp.track as Track) : undefined
  const dayN = Number(sp.day)
  const day = Number.isInteger(dayN) && dayN >= 1 && dayN <= TOTAL_DAYS ? dayN : undefined
  const c = await cols()
  const items = await c.materials.find(track ? { track } : {}).sort({ createdAt: -1 }).limit(300).toArray()
  const shelf = SHELF.filter((x) => !track || x.track === track)

  return (
    <>
      <h1 className="display">Library</h1>
      <p className="lede">Your notes, links and files, plus the references the plan leans on.</p>

      <MaterialForm defaultDay={day} defaultOpen={Boolean(day)} />

      <nav className="chips" aria-label="Filter by track">
        <Link className="chip" href="/library" aria-current={!track}>
          All
        </Link>
        {TRACKS.filter((t) => t.id !== 'review' && t.id !== 'contest').map((t) => (
          <Link key={t.id} className="chip" href={`/library?track=${t.id}`} aria-current={track === t.id}>
            {t.short}
          </Link>
        ))}
      </nav>

      <section className="section" style={{ marginTop: 16 }}>
        <div className="section-head">
          <h2 className="h2">Saved by you</h2>
          <span className="small muted tnum">{items.length}</span>
        </div>
        {items.length ? (
          <ul className="list">
            {items.map((m) => {
              const href = m.file ? `/api/files/${m.file.id}` : m.url!
              return (
                <li key={m._id.toString()}>
                  <div style={{ minWidth: 0 }}>
                    <a className="title" href={href} target="_blank" rel="noreferrer">
                      {m.title}
                    </a>
                    <div className="task-meta">
                      <span className="track" data-t={m.track}>
                        {trackName(m.track as Track)}
                      </span>
                      {m.file && (
                        <span className="tnum">
                          {m.file.size < 1024 * 1024 ? `${Math.max(1, Math.round(m.file.size / 1024))} KB` : `${(m.file.size / 1024 / 1024).toFixed(1)} MB`} file
                        </span>
                      )}
                      {m.day && <Link href={`/day/${m.day}`}>Day {m.day}</Link>}
                    </div>
                    {m.note && <p className="task-note">{m.note}</p>}
                  </div>
                  <form action={deleteMaterial.bind(null, m._id.toString())}>
                    <button className="icon-btn" aria-label={`Delete ${m.title}`} title="Delete">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                        <path d="M5 7h14M10 11v6m4-6v6M7 7l1 13h8l1-13M9 7V4h6v3" />
                      </svg>
                    </button>
                  </form>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="empty">Nothing saved{track ? ' in this track' : ''} yet. Add a cheat sheet, a Drive link or a PDF above.</p>
        )}
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="h2">Reference shelf</h2>
        </div>
        <ul className="list">
          {shelf.map((r) => (
            <li key={r.url}>
              <div>
                <a className="title" href={r.url} target="_blank" rel="noreferrer">
                  {r.title}
                </a>
                <div className="task-meta">
                  <span className="track" data-t={r.track}>
                    {trackName(r.track)}
                  </span>
                  <span>{r.why}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
