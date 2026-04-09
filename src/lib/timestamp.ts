/** Parse datetime-local value to ISO UTC, or null if empty/invalid. */
export function fromDatetimeLocal(value: string | null | undefined): string | null {
  if (value == null || value.trim() === '') return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

/** Format ISO timestamptz for HTML datetime-local (local timezone). */
export function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function formatLocalDisplay(
  iso: string | null | undefined,
  includeTime = true
): string {
  if (!iso) return 'N/A'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'Invalid Date'

  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    ...(includeTime && { timeStyle: 'short' }),
  })
}