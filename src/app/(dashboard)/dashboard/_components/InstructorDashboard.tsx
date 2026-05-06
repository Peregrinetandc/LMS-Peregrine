import Link from 'next/link'
import { BookOpen, FileText, ChevronRight, PlusCircle, Pencil } from 'lucide-react'
import { AppButton, EmptyState, PageHeader } from '@/components/ui/primitives'
import type { InstructorSummary, MetricCard } from '../_types'
import MetricCardGrid from './MetricCardGrid'

export default function InstructorDashboard({
  name,
  isAdmin,
  courses,
}: {
  name: string
  isAdmin: boolean
  courses: InstructorSummary['courses']
}) {
  const totalLearners = courses.reduce((sum, c) => sum + (c.enrollment_count ?? 0), 0)

  const metrics: MetricCard[] = [
    {
      label: isAdmin ? 'All Courses' : 'My Courses',
      value: courses.length,
      icon: <BookOpen className="w-12.5 h-12.5 text-blue-500" />,
      bg: 'bg-blue-50',
    },
    {
      label: 'Total Learners',
      value: totalLearners,
      icon: <FileText className="w-12.5 h-12.5 text-amber-500" />,
      bg: 'bg-amber-50',
    },
  ]

  return (
    <div className="space-y-4 px-2 py-4">
      <PageHeader
        title={`Welcome back, ${name}!`}
        action={
          <Link href="/admin/courses/new" className="inline-flex">
            <AppButton>
              <PlusCircle className="w-4 h-4" />
              Create Course
            </AppButton>
          </Link>
        }
      />

      {/* Metric Cards */}
      <MetricCardGrid metrics={metrics} />

      {/* Course List */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-semibold text-slate-900">
            {isAdmin ? 'All Courses' : 'Your Courses'}
          </h3>
          <Link href="/courses" className="text-sm text-blue-600 hover:underline">
            View all
          </Link>
        </div>

        {courses.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No courses yet"
              description={
                isAdmin
                  ? 'No courses are available yet.'
                  : 'Create your first course to start teaching.'
              }
              action={
                <Link
                  href="/admin/courses/new"
                  className="text-sm font-medium text-blue-600 hover:underline"
                >
                  Create your first course
                </Link>
              }
            />
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {courses.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-2 px-6 py-4 hover:bg-slate-50 transition group"
              >
                <Link
                  href={`/courses/${c.id}`}
                  className="flex items-center justify-between flex-1 min-w-0"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <BookOpen className="w-4 h-4 text-slate-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 group-hover:text-blue-600 truncate">
                        <em className="not-italic text-slate-500 font-normal mr-1.5">
                          {c.course_code}
                        </em>
                        {c.title}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        {c.department_name ? (
                          <span className="text-[11px] text-slate-500">{c.department_name}</span>
                        ) : null}
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
                            c.status === 'published'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {c.status}
                        </span>
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 shrink-0" />
                </Link>
                <Link
                  href={`/admin/courses/${c.id}/edit`}
                  className="shrink-0 p-2 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition"
                  title="Edit course"
                  aria-label={`Edit ${c.title}`}
                >
                  <Pencil className="w-4 h-4" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
