/**
 * Week 1 unlocks at course start; each further week adds 7 days from that same clock time.
 * Returns ISO string for Postgres timestamptz, or null if course has no start date.
 */
export function unlockAtForWeek(
  courseStartsAt: string | Date | null | undefined,
  weekIndex: number
): string | null {
  if (courseStartsAt == null || courseStartsAt === '') return null
  const start = courseStartsAt instanceof Date ? courseStartsAt : new Date(courseStartsAt)
  if (Number.isNaN(start.getTime())) return null
  const w = Math.max(1, Math.trunc(Number(weekIndex)) || 1)
  const ms = start.getTime() + (w - 1) * 7 * 24 * 60 * 60 * 1000
  return new Date(ms).toISOString()
}


export {fromDatetimeLocal, toDatetimeLocalValue} from "./timestamp"

/** If stored unlock matches course schedule for this week, treat as auto. */
export function deriveUnlockMode(
  courseStartsAt: string | null | undefined,
  weekIndex: number,
  availableFromIso: string | null | undefined
): 'auto' | 'manual' {
  if (!availableFromIso) return 'auto'
  const auto = courseStartsAt?.trim()
    ? unlockAtForWeek(courseStartsAt, weekIndex)
    : null
  if (!auto) return 'manual'
  const diff = Math.abs(new Date(availableFromIso).getTime() - new Date(auto).getTime())
  return diff < 120_000 ? 'auto' : 'manual'
}
