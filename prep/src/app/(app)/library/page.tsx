import Link from 'next/link'
import type { Metadata } from 'next'
import { cols } from '@/lib/db'
import { TRACKS, TOTAL_DAYS, trackName, type Track } from '@/lib/plan'
import { deleteMaterial } from '@/app/actions'
import { MaterialForm } from '@/components/MaterialForm'

export const metadata: Metadata = { title: 'Library' }

// Community-recommended material: the resources that come up again and again in Hacker News and
// Reddit threads, interview write-ups and backend/infra engineers' reading lists.
const SHELF: { title: string; url: string; track: Track; why: string }[] = [
  { title: 'NeetCode roadmap', url: 'https://neetcode.io/roadmap', track: 'dsa', why: 'The 150 core problems as a dependency graph, each with a video.' },
  { title: 'Grind 75', url: 'https://www.techinterviewhandbook.org/grind75/', track: 'dsa', why: 'A schedule-aware problem list from the Blind 75 author.' },
  { title: "Striver's A2Z DSA sheet", url: 'https://takeuforward.org/strivers-a2z-dsa-course/strivers-a2z-dsa-course-sheet-2', track: 'dsa', why: 'The most-used topic sheet in India, with video solutions.' },
  { title: 'CP-Algorithms', url: 'https://cp-algorithms.com/', track: 'dsa', why: 'Reference for segment trees, shortest paths and string algorithms.' },
  { title: 'Designing Data-Intensive Applications', url: 'https://dataintensive.net/', track: 'backend', why: 'The single most recommended backend book. Fridays from week 7 walk through it.' },
  { title: 'CMU 15-445: database systems (Andy Pavlo)', url: 'https://15445.courses.cs.cmu.edu/', track: 'backend', why: 'Free lectures on storage, indexes, concurrency control and recovery.' },
  { title: 'MIT 6.824 / 6.5840: distributed systems', url: 'https://pdos.csail.mit.edu/6.824/', track: 'backend', why: 'The standard distributed systems course: MapReduce, Raft, sharded KV labs.' },
  { title: "Amazon Builders' Library", url: 'https://aws.amazon.com/builders-library/', track: 'backend', why: 'How Amazon handles timeouts, retries, load shedding and deployments.' },
  { title: 'Use The Index, Luke', url: 'https://use-the-index-luke.com/', track: 'backend', why: 'SQL indexing for developers, free online.' },
  { title: 'Hussein Nasser: backend courses', url: 'https://courses.husseinnasser.com/', track: 'backend', why: 'OS, networking and backend fundamentals. His YouTube covers much of it free.' },
  { title: 'Gossip Glomers (Fly.io)', url: 'https://fly.io/dist-sys/', track: 'backend', why: 'Hands-on distributed systems challenges: broadcast, counters, Kafka-style logs.' },
  { title: 'roadmap.sh: backend', url: 'https://roadmap.sh/backend', track: 'backend', why: 'A checklist of backend topics to spot gaps.' },
  { title: 'The Missing Semester (MIT)', url: 'https://missing.csail.mit.edu/', track: 'infra', why: 'Shell, git, debugging and tooling that courses skip.' },
  { title: 'Kubernetes the Hard Way', url: 'https://github.com/kelseyhightower/kubernetes-the-hard-way', track: 'infra', why: 'Build a cluster by hand to understand every component.' },
  { title: 'Killercoda Kubernetes scenarios', url: 'https://killercoda.com/', track: 'infra', why: 'Free in-browser clusters for practice and CKA-style drills.' },
  { title: "Adrian Cantrill's AWS courses", url: 'https://learn.cantrill.io/', track: 'infra', why: 'The AWS course engineers rate highest for real understanding, not just exams.' },
  { title: 'Cloud Resume Challenge (AWS)', url: 'https://cloudresumechallenge.dev/docs/the-challenge/aws/', track: 'infra', why: 'A guided project covering IaC, serverless and CI/CD.' },
  { title: 'EKS Workshop', url: 'https://www.eksworkshop.com/', track: 'infra', why: "AWS's hands-on Kubernetes labs." },
  { title: 'Terraform on AWS tutorials', url: 'https://developer.hashicorp.com/terraform/tutorials/aws-get-started', track: 'infra', why: 'The official path from first resource to modules and remote state.' },
  { title: 'Google SRE book', url: 'https://sre.google/sre-book/table-of-contents/', track: 'infra', why: 'SLOs, alerting, on-call and postmortems, free online.' },
  { title: 'SadServers', url: 'https://sadservers.com/', track: 'infra', why: 'Broken Linux boxes to debug, like an on-call shift.' },
  { title: 'The Twelve-Factor App', url: 'https://12factor.net/', track: 'infra', why: 'Short and still the baseline for deployable services.' },
  { title: 'Hello Interview: system design', url: 'https://www.hellointerview.com/learn/system-design/in-a-hurry/introduction', track: 'hld', why: 'The current favorite for interview-style design, written by ex-Meta interviewers.' },
  { title: 'System Design Primer', url: 'https://github.com/donnemartin/system-design-primer', track: 'hld', why: 'Free building blocks and classic case studies.' },
  { title: 'ByteByteGo (Alex Xu)', url: 'https://bytebytego.com/', track: 'hld', why: "The System Design Interview books' online edition plus visual explainers." },
  { title: 'Jordan has no life', url: 'https://www.youtube.com/@jordanhasnolife5163', track: 'hld', why: 'Deeper design walkthroughs once the basics feel easy.' },
  { title: 'Refactoring.Guru design patterns', url: 'https://refactoring.guru/design-patterns', track: 'lld', why: 'Every GoF pattern with diagrams and code.' },
  { title: 'Awesome low-level design', url: 'https://github.com/ashishps1/awesome-low-level-design', track: 'lld', why: 'Machine coding problems with solutions.' },
  { title: 'What forward deployed engineers do', url: 'https://newsletter.pragmaticengineer.com/p/forward-deployed-engineers', track: 'fde', why: "The Pragmatic Engineer's breakdown of the role at Palantir, OpenAI and others." },
  { title: 'Building effective agents (Anthropic)', url: 'https://www.anthropic.com/engineering/building-effective-agents', track: 'fde', why: 'When to use workflows vs agents. FDE design rounds ask exactly this.' },
  { title: 'Your AI product needs evals (Hamel Husain)', url: 'https://hamel.dev/blog/posts/evals/', track: 'fde', why: 'How to prove an LLM system works. The most-cited evals guide.' },
  { title: 'What we learned from a year of building with LLMs', url: 'https://applied-llms.org/', track: 'fde', why: 'Practitioner lessons on RAG, prompting, evals and operations.' },
  { title: 'OpenAI Cookbook', url: 'https://cookbook.openai.com/', track: 'fde', why: 'Working examples for retrieval, tool use and batch jobs.' },
  { title: 'Model Context Protocol', url: 'https://modelcontextprotocol.io/', track: 'fde', why: 'The standard for giving LLMs tools. Anthropic FDE screens test fluency in it.' },
  { title: 'OSTEP (free OS textbook)', url: 'https://pages.cs.wisc.edu/~remzi/OSTEP/', track: 'cs', why: 'The chapters behind the OS videos.' },
  { title: 'High Performance Browser Networking', url: 'https://hpbn.co/', track: 'cs', why: 'TCP, TLS, HTTP/2 and latency, free online.' },
  { title: "Beej's Guide to Network Programming", url: 'https://beej.us/guide/bgnet/', track: 'cs', why: 'Sockets from the ground up.' },
  { title: 'Tech Interview Handbook', url: 'https://www.techinterviewhandbook.org/', track: 'career', why: 'Resume, behavioral and negotiation guides.' },
  { title: 'interviewing.io', url: 'https://interviewing.io/', track: 'career', why: 'Anonymous mock interviews with engineers from target companies.' },
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
