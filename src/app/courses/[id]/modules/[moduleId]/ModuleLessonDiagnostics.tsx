'use client'

import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { isLessonPageDiagnosticsEnabled } from '@/lib/lesson-page-diagnostics'

/**
 * Client-only: surfaces server-detected issues (Supabase errors, missing assignment embed)
 * because the lesson page is a Server Component and cannot call toast directly.
 *
 * Render only when `isLessonPageDiagnosticsEnabled()` is true (dev by default, or
 * NEXT_PUBLIC_LESSON_PAGE_DIAGNOSTICS). The effect also no-ops if disabled.
 */
export default function ModuleLessonDiagnostics({
  moduleFetchError,
  assignmentEmbedMissing,
  secondaryErrorsSummary,
}: {
  moduleFetchError: string | null
  assignmentEmbedMissing: boolean
  secondaryErrorsSummary: string | null
}) {
  const fired = useRef(false)

  useEffect(() => {
    if (!isLessonPageDiagnosticsEnabled()) return
    if (fired.current) return
    fired.current = true

    if (moduleFetchError) {
      toast.error('Lesson load failed', { description: moduleFetchError })
    }

    if (secondaryErrorsSummary) {
      toast.error('Lesson page: partial data errors', { description: secondaryErrorsSummary })
    }

    if (assignmentEmbedMissing) {
      toast.warning(
        'Assignment embed missing (embed-only path)',
        {
          description:
            '`firstEmbeddedAssignment(mod.assignments)` is null. DB fallback is disabled for testing the optimized nested select. Re-enable fallback in page.tsx if needed.',
          duration: 14_000,
        },
      )
    }
  }, [moduleFetchError, assignmentEmbedMissing, secondaryErrorsSummary])

  return null
}
