import AssignmentUpload from '@/components/AssignmentUpload'
import ExpandableText from '@/components/ExpandableText'
import { formatLocalDisplay } from '@/lib/timestamp'
import type { LoadedModule } from '../_lib/load-module-page'

export function AssignmentRenderer({ data }: { data: LoadedModule }) {
  const { title, assignmentRow } = data

  if (!assignmentRow) {
    return (
      <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <p className="font-semibold">Assignment details not in embedded response</p>
        <p className="text-xs text-amber-800">
          Embed-only mode (fallback query disabled). See warning toast — if the row exists in the DB, re-enable the
          fallback block in <code className="rounded bg-amber-100 px-1">page.tsx</code> or fix the nested select.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
        <h2 className="text-base sm:text-lg font-bold text-slate-900">{title}</h2>
        <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-blue-700 sm:px-3 sm:py-1 sm:text-xs">
          Assignment
        </span>
      </div>
      {assignmentRow.description && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-[13px] text-slate-700 sm:px-4 sm:py-3 sm:text-sm">
          <ExpandableText text={assignmentRow.description} />
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 sm:px-4 sm:py-3">
          <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wide text-slate-500">Max score</p>
          <p className="mt-0.5 sm:mt-1 text-base sm:text-lg font-bold text-slate-900">{assignmentRow.max_score ?? '—'}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 sm:px-4 sm:py-3">
          <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wide text-slate-500">Passing score</p>
          <p className="mt-0.5 sm:mt-1 text-base sm:text-lg font-bold text-slate-900">{assignmentRow.passing_score ?? '—'}</p>
        </div>
      </div>
      {assignmentRow.deadline_at && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2.5 text-[13px] text-amber-900 sm:px-4 sm:py-3 sm:text-sm">
          <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wide text-amber-700">Deadline</p>
          <p className="mt-0.5 sm:mt-1 font-medium">{formatLocalDisplay(assignmentRow.deadline_at)}</p>
        </div>
      )}
      <AssignmentUpload assignmentId={assignmentRow.id} deadlineAt={assignmentRow.deadline_at} />
    </div>
  )
}
