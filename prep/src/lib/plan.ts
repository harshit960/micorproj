import raw from '@/data/plan.json'

export type Track = 'dsa' | 'backend' | 'infra' | 'hld' | 'lld' | 'fde' | 'cs' | 'career' | 'contest' | 'review'
export type TaskKind = 'problem' | 'video' | 'read' | 'practice' | 'contest'

export interface Task {
  id: string
  kind: TaskKind
  track: Track
  title: string
  url?: string
  mins: number
  optional?: boolean
  note?: string
  extra?: string
  // problem
  slug?: string
  difficulty?: 'Easy' | 'Medium' | 'Hard'
  lcId?: number
  tags?: string[]
  // video
  videoId?: string
  videoTitle?: string
  channel?: string
  duration?: string
}

export interface Day { n: number; week: number; dow: number; title: string; tasks: Task[] }
export interface Week { n: number; phase: string; theme: string; days: Day[] }
export interface Phase { id: string; name: string; from: number; to: number; summary: string }

export const plan = raw as unknown as {
  version: number
  phases: Phase[]
  weeks: Week[]
  baseline: { leetcode: { total: number; easy: number; medium: number; hard: number; contests: number; rating: number } }
}

export const WEEKS = plan.weeks
export const DAYS: Day[] = WEEKS.flatMap((w) => w.days)
export const TOTAL_DAYS = DAYS.length
export const TOTAL_WEEKS = WEEKS.length

export function getDay(n: number): Day | undefined {
  return DAYS[n - 1]
}

export function phaseOf(week: number): Phase {
  return plan.phases.find((p) => week >= p.from && week <= p.to) ?? plan.phases[0]
}

export function required(day: Day): Task[] {
  return day.tasks.filter((t) => !t.optional)
}

export const TRACKS: { id: Track; name: string; short: string }[] = [
  { id: 'dsa', name: 'Problem solving', short: 'DSA' },
  { id: 'backend', name: 'Backend depth', short: 'Backend' },
  { id: 'infra', name: 'Cloud and infra', short: 'Infra' },
  { id: 'hld', name: 'System design', short: 'HLD' },
  { id: 'lld', name: 'Low-level design', short: 'LLD' },
  { id: 'fde', name: 'Forward deployed', short: 'FDE' },
  { id: 'cs', name: 'CS fundamentals', short: 'CS' },
  { id: 'career', name: 'Resume and interviews', short: 'Career' },
  { id: 'contest', name: 'Contests', short: 'Contest' },
  { id: 'review', name: 'Review', short: 'Review' },
]
export const trackName = (t: Track) => TRACKS.find((x) => x.id === t)?.short ?? t

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
