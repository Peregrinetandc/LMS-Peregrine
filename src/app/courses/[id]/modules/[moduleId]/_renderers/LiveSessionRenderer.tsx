import { CalendarDays, CheckCircle2, Clock3 } from 'lucide-react'
import ExpandableText from '@/components/ExpandableText'
import type { LoadedModule } from '../_lib/load-module-page'

export function LiveSessionRenderer({ data }: { data: LoadedModule }) {
  const { title, description, sessionFields, contentUrl, isEnrolled, sessionAttendanceMarked } = data

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
        <h2 className="text-base sm:text-lg font-bold text-slate-900">{title}</h2>
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <span className="rounded-full bg-purple-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-purple-700 sm:px-3 sm:py-1 sm:text-xs">
            Live session
          </span>
        </div>
      </div>
      {description && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-[13px] text-slate-700 sm:px-4 sm:py-3 sm:text-sm">
          <ExpandableText text={description} />
        </div>
      )}
      <div className="rounded-lg border border-indigo-200 bg-indigo-50/60 px-3 py-2.5 text-[13px] text-indigo-900 sm:px-4 sm:py-3 sm:text-sm">
        <p className="font-semibold">Live session instructions</p>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-indigo-800">
          <li>Join 5-10 minutes before start time.</li>
          <li>Use your real name so attendance is recorded correctly.</li>
          <li>Keep mic muted when not speaking and participate actively.</li>
        </ul>
      </div>
      {isEnrolled && (
        <div className="flex justify-end">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide sm:px-3 sm:py-1 sm:text-xs ${
              sessionAttendanceMarked
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-amber-100 text-amber-800'
            }`}
          >
            {sessionAttendanceMarked ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
            {sessionAttendanceMarked ? 'Attendance marked' : 'Attendance pending'}
          </span>
        </div>
      )}
      {(sessionFields.session_start_at || sessionFields.session_end_at) && (
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 sm:px-4 sm:py-3">
          <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wide text-slate-500">Schedule</p>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {sessionFields.session_start_at && (
              <div className="rounded-lg border border-purple-200 bg-purple-50/60 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-purple-700">Starts</p>
                <p className="mt-1 inline-flex items-start gap-2 text-sm text-slate-800">
                  <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-purple-600" />
                  <span>{new Date(sessionFields.session_start_at).toLocaleString()}</span>
                </p>
              </div>
            )}
            {sessionFields.session_end_at && (
              <div className="rounded-lg border border-indigo-200 bg-indigo-50/60 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-700">Ends</p>
                <p className="mt-1 inline-flex items-start gap-2 text-sm text-slate-800">
                  <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
                  <span>{new Date(sessionFields.session_end_at).toLocaleString()}</span>
                </p>
              </div>
            )}
          </div>
        </div>
      )}
      {contentUrl && (
        <a
          href={contentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 sm:px-6 sm:text-base"
        >
          Join Session →
        </a>
      )}
    </div>
  )
}
