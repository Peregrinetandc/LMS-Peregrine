import Link from 'next/link'
import { FileText, Clock, ChevronRight, Flame } from 'lucide-react'
import { PageHeader } from '@/components/ui/primitives'
import { formatLocalDisplay } from '@/lib/timestamp'
import type { LearnerSummary, MetricCard } from '../_types'
import MetricCardGrid from './MetricCardGrid'
import ContinueLearning from './ContinueLearning'

export default function LearnerDashboard({
  name,
  summary,
}: {
  name: string
  summary: LearnerSummary
}) {
  const { enrolled_courses, streak: rawStreak, due_assignments } = summary
  const streak = rawStreak ?? 0

  const metrics: MetricCard[] = [
    {
      label: 'Day streak',
      value: streak,
      icon: <Flame className="w-12.5 h-12.5 text-orange-500" />,
      bg: 'bg-orange-50',
      hint: streak === 0 ? 'Complete a lesson to start' : undefined,
    },
    {
      label: 'Assignments Due',
      value: due_assignments.length,
      icon: <FileText className="w-12.5 h-12.5 text-amber-500" />,
      bg: 'bg-amber-50',
    },
  ]

  // Map RPC shape → ContinueLearning component shape
  const enrolledCourses = enrolled_courses.map((c) => ({
    id: c.id,
    course_code: c.course_code,
    title: c.title,
    thumbnail_url: c.thumbnail_url ?? undefined,
    progress: c.progress,
  }))

  return (
    <div className="space-y-4 px-2 py-4">
      <PageHeader title={`Welcome back, ${name}!`} />

      {/* Metric Cards */}
      <MetricCardGrid metrics={metrics} />

      {/* Enrolled Courses */}
      <ContinueLearning enrolledCourses={enrolledCourses} />

      {/* Due Assignments */}
      {due_assignments.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          {/* Header */}
          <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h3 className="font-bold text-slate-500 text-[10px] uppercase tracking-wider">
              Assignments due
            </h3>
            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
              {due_assignments.length}
            </span>
          </div>

          {/* Assignment List */}
          <ul className="divide-y divide-slate-50">
            {due_assignments.map((a) => (
              <li key={a.assignment_id}>
                <Link
                  href={`/courses/${a.course_id}/modules/${a.module_id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors group"
                >
                  {/* Icon */}
                  <div className="h-8 w-8 rounded-md bg-slate-50 flex items-center justify-center shrink-0 group-hover:bg-amber-50 transition-colors">
                    <FileText className="w-4 h-4 text-slate-400 group-hover:text-amber-600 transition-colors" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 group-hover:text-blue-600 transition-colors truncate">
                          {a.module_title}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate -mt-0.5">
                          {a.course_title}
                        </p>
                      </div>

                      {/* Due Date */}
                      <div className="flex items-center gap-1 mt-1 sm:mt-0">
                        <Clock className="w-3 h-3 text-amber-500/70" />
                        <span className="text-[11px] font-medium text-amber-600/90 whitespace-nowrap">
                          {formatLocalDisplay(a.deadline_at, true)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Chevron */}
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-400 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
