import FeedbackSubmitClient from '@/components/FeedbackSubmitClient'
import type { LoadedModule } from '../_lib/load-module-page'

export function FeedbackRenderer({ data }: { data: LoadedModule }) {
  const { title, description, moduleId, isEnrolled, isCourseStaff, feedbackSubmitted } = data

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="lg:text-lg text-base font-bold text-slate-900">{title}</h2>
        <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-rose-700">
          Feedback
        </span>
      </div>
      {description && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm whitespace-pre-wrap text-slate-700">
          {description}
        </div>
      )}
      {isEnrolled && (
        <FeedbackSubmitClient moduleId={moduleId} submittedInitially={feedbackSubmitted} />
      )}
      {isCourseStaff && !isEnrolled && (
        <p className="text-sm text-slate-500">Learners enrolled in this course will submit feedback here.</p>
      )}
    </div>
  )
}
