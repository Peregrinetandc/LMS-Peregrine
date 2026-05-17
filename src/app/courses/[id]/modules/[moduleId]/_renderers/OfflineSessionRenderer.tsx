import { CalendarDays, CheckCircle2, Clock3, MapPin } from 'lucide-react'
import type { LoadedModule } from '../_lib/load-module-page'

export function OfflineSessionRenderer({ data }: { data: LoadedModule }) {
  const { title, description, sessionFields, isEnrolled, sessionAttendanceMarked } = data

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
        <h2 className="text-base sm:text-lg font-bold text-slate-900">{title}</h2>
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700 sm:px-3 sm:py-1 sm:text-xs">
            Offline session
          </span>
        </div>
      </div>
      {description && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-[13px] whitespace-pre-wrap text-slate-700 sm:px-4 sm:py-3 sm:text-sm">
          {description}
        </div>
      )}
      <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2.5 text-[13px] text-amber-900 sm:px-4 sm:py-3 sm:text-sm">
        <p className="font-semibold">Offline session instructions</p>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-amber-800">
          <li>Arrive at least 10 minutes early at the venue.</li>
          <li>Bring required materials and keep your ID ready for attendance.</li>
          <li>Follow classroom/lab safety and instructor instructions.</li>
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
      <div className="grid grid-cols-1 gap-2 sm:gap-3 sm:grid-cols-2">
        {sessionFields.session_location && (
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 sm:px-4 sm:py-3">
            <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wide text-slate-500">Location</p>
            <p className="mt-1 inline-flex items-start gap-2 text-[13px] sm:text-sm font-medium text-slate-800">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <span>{sessionFields.session_location}</span>
            </p>
          </div>
        )}

        {(sessionFields.session_start_at || sessionFields.session_end_at) && (
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 sm:px-4 sm:py-3">
            <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wide text-slate-500">Schedule</p>
            <div className="mt-2 grid grid-cols-1 gap-2">
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
      </div>
    </div>
  )
}
