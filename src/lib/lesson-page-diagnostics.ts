/**
 * Lesson/module page diagnostic toasts (embed errors, partial Supabase errors).
 * Off in production unless explicitly enabled (avoids noise for learners).
 *
 * Enable on any build: set NEXT_PUBLIC_LESSON_PAGE_DIAGNOSTICS=true (or 1 / yes) in env.
 */
export function isLessonPageDiagnosticsEnabled(): boolean {
  if (process.env.NODE_ENV === 'development') return true
  const v = process.env.NEXT_PUBLIC_LESSON_PAGE_DIAGNOSTICS?.trim().toLowerCase()
  return v === 'true' || v === '1' || v === 'yes'
}
