import { PageHeader } from '@/components/ui/primitives'
import AttendanceReportClient from './AttendanceReportClient'
import type { AttendanceReportCourseOption } from './types'
import { ROLES } from '@/lib/roles'
import { requireRolePage } from '@/lib/auth/require-role'

export default async function AttendanceReportPage() {
  const { user, role, supabase } = await requireRolePage('instructor')

  let coursesQuery = supabase.from('courses').select('id, title, course_code').order('title')
  if (role !== ROLES.ADMIN) {
    coursesQuery = coursesQuery.eq('instructor_id', user.id)
  }
  const { data: courses } = await coursesQuery

  return (
    <div className="space-y-6 p-2">
      <PageHeader
        title="Attendance report"
        description="Browse live and offline sessions by course; open a session to page through attendance rows."
      />
      <AttendanceReportClient courses={(courses ?? []) as AttendanceReportCourseOption[]} />
    </div>
  )
}

