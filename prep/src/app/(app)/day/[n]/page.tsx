import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { DayView } from '@/components/DayView'
import { getDay } from '@/lib/plan'
import { getSettings, clock } from '@/lib/store'

export async function generateMetadata(props: PageProps<'/day/[n]'>): Promise<Metadata> {
  const { n } = await props.params
  return { title: `Day ${n}` }
}

export default async function DayPage(props: PageProps<'/day/[n]'>) {
  const { n: raw } = await props.params
  const n = Number(raw)
  if (!Number.isInteger(n) || !getDay(n)) notFound()
  const c = clock(await getSettings())
  if (n === c.todayN && c.started && !c.finished) redirect('/')
  return <DayView n={n} isToday={false} />
}
