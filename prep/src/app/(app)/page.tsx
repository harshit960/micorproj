import { DayView } from '@/components/DayView'
import { getSettings, clock } from '@/lib/store'

export default async function TodayPage() {
  const c = clock(await getSettings())
  return <DayView n={c.todayN} isToday />
}
