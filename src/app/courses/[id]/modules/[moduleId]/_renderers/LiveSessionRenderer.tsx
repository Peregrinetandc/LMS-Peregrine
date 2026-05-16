import { CalendarDays, CheckCircle2, Clock3 } from 'lucide-react'
import type { LoadedModule } from '../_lib/load-module-page'

export function LiveSessionRenderer({ data }: { data: LoadedModule }) {
  const { title, sessionFields, contentUrl, isEnrolled, sessionAttendanceMarked } = data

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="lg:text-lg text-base font-bold text-slate-900">{title}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-purple-700">
            Live session
          </span>
        </div>
      </div>
      <div className="rounded-lg border border-indigo-200 bg-indigo-50/60 px-4 py-3 text-sm text-indigo-900">
        <p className="font-semibold">Live session instructions</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-indigo-800">
          <li>Join 5-10 minutes before start time.</li>
          <li>Use your real name so attendance is recorded correctly.</li>
          <li>Keep mic muted when not speaking and participate actively.</li>
        </ul>
      </div>
      {isEnrolled && (
        <div className="flex justify-end">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
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
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Schedule</p>
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
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2 font-semibold text-white transition hover:bg-indigo-700"
        >
          Join Session →
        </a>
      )}
    </div>
  )
}
