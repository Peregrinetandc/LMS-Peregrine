export const dynamic = 'force-dynamic'
export const revalidate = 0

import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import NextLessonButton from './NextLessonButton'
import { isLessonPageDiagnosticsEnabled } from '@/lib/lesson-page-diagnostics'
import ModuleLessonDiagnostics from './ModuleLessonDiagnostics'
import { loadModulePage } from './_lib/load-module-page'
import { VideoRenderer } from './_renderers/VideoRenderer'
import { AssignmentRenderer } from './_renderers/AssignmentRenderer'
import { LiveSessionRenderer } from './_renderers/LiveSessionRenderer'
import { OfflineSessionRenderer } from './_renderers/OfflineSessionRenderer'
import { QuizRenderer } from './_renderers/QuizRenderer'
import { FeedbackRenderer } from './_renderers/FeedbackRenderer'
import { ExternalResourceRenderer } from './_renderers/ExternalResourceRenderer'

export default async function ModulePage({ params }: { params: Promise<{ id: string; moduleId: string }> }) {
  const { id: courseId, moduleId } = await params
  const showLessonDiagnostics = isLessonPageDiagnosticsEnabled()
  const result = await loadModulePage(courseId, moduleId)

  if (result.kind === 'unauthorized') redirect('/login')
  if (result.kind === 'no-access') redirect(`/courses/${courseId}`)
  if (result.kind === 'not-found') notFound()

  if (result.kind === 'fetch-error') {
    return (
      <>
        {showLessonDiagnostics && (
          <ModuleLessonDiagnostics
            moduleFetchError={result.error}
            assignmentEmbedMissing={false}
            secondaryErrorsSummary={null}
          />
        )}
        <div className="mx-auto max-w-lg space-y-3 py-16 text-center">
          <h1 className="text-lg font-semibold text-slate-900">Could not load this lesson</h1>
          <p className="text-sm text-slate-600">{result.error}</p>
          <Link
            href={`/courses/${courseId}`}
            className="inline-block text-sm font-medium text-blue-600 underline"
          >
            Back to course
          </Link>
        </div>
      </>
    )
  }

  if (result.kind === 'locked') {
    const diagnosticsProps = {
      moduleFetchError: null as string | null,
      assignmentEmbedMissing: false,
      secondaryErrorsSummary:
        result.secondaryErrors.length > 0 ? result.secondaryErrors.join('\n') : null,
    }
    return (
      <>
        {showLessonDiagnostics && <ModuleLessonDiagnostics {...diagnosticsProps} />}
        <div className="max-w-2xl mx-auto text-center py-20">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Lesson Locked</h1>
          <p className="text-slate-500">
            This lesson unlocks on <strong>{result.unlockDate}</strong>.
          </p>
        </div>
      </>
    )
  }

  const d = result.data
  const diagnosticsProps = {
    moduleFetchError: null as string | null,
    assignmentEmbedMissing: d.assignmentEmbedMissing,
    secondaryErrorsSummary:
      d.secondaryErrors.length > 0 ? d.secondaryErrors.join('\n') : null,
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 lg:mt-4">
      {showLessonDiagnostics && <ModuleLessonDiagnostics {...diagnosticsProps} />}
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        Week {d.weekIndex ?? 1}
      </p>

      {d.type === 'video' && <VideoRenderer data={d} />}
      {d.type === 'assignment' && <AssignmentRenderer data={d} />}
      {d.type === 'live_session' && <LiveSessionRenderer data={d} />}
      {d.type === 'offline_session' && <OfflineSessionRenderer data={d} />}
      {d.type === 'mcq' && <QuizRenderer data={d} />}
      {d.type === 'feedback' && <FeedbackRenderer data={d} />}
      {d.type === 'external_resource' && <ExternalResourceRenderer data={d} />}

      {d.isEnrolled && !d.isCourseStaff && d.showNextButton && (
        <NextLessonButton
          courseId={d.courseId}
          currentModuleId={d.moduleId}
          nextModule={d.nextModule}
          initialCompleted={d.currentModuleComplete}
          nextDisabledReason={d.nextDisabledReason}
        />
      )}
    </div>
  )
}
