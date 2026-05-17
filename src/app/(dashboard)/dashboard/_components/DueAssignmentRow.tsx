import Link from 'next/link'
import { FileText, Clock, ChevronRight } from 'lucide-react'
import { formatLocalDisplay } from '@/lib/timestamp'
import type { DueAssignment } from '../_types'

export default function DueAssignmentRow({
  assignment,
  showCourseTitle = true,
}: {
  assignment: DueAssignment
  showCourseTitle?: boolean
}) {
  const a = assignment
  return (
    <Link
      href={`/courses/${a.course_id}/modules/${a.module_id}`}
      className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors group"
    >
      <div className="h-8 w-8 rounded-md bg-slate-50 flex items-center justify-center shrink-0 group-hover:bg-amber-50 transition-colors">
        <FileText className="w-4 h-4 text-slate-400 group-hover:text-amber-600 transition-colors" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800 group-hover:text-blue-600 transition-colors truncate">
              {a.module_title}
            </p>
            {showCourseTitle ? (
              <p className="text-[11px] text-slate-400 truncate -mt-0.5">
                {a.course_title}
              </p>
            ) : null}
          </div>

          <div className="flex items-center gap-1 mt-1 sm:mt-0">
            <Clock className="w-3 h-3 text-amber-500/70" />
            <span className="text-[11px] font-medium text-amber-600/90 whitespace-nowrap">
              {formatLocalDisplay(a.deadline_at, true)}
            </span>
          </div>
        </div>
      </div>

      <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-400 transition-transform group-hover:translate-x-0.5" />
    </Link>
  )
}
