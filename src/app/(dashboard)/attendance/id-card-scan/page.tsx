import { AppCard, PageHeader } from '@/components/ui/primitives'
import IdCardScanAttendanceClient from './IdCardScanAttendanceClient'
import type { AttendanceCourseOption } from '../AttendanceClient'
import { ROLES } from '@/lib/roles'
import { requireRolePage } from '@/lib/auth/require-role'

export default async function IdCardScanAttendancePage() {
  const { user, role, supabase } = await requireRolePage('staff')

  let coursesQuery = supabase
    .from('courses')
    .select('id, title, course_code')
    .neq('status', 'draft')
    .order('title')
  if (role !== ROLES.ADMIN && role !== ROLES.COORDINATOR) {
    coursesQuery = coursesQuery.eq('instructor_id', user.id)
  }
  const { data: courses } = await coursesQuery
  const courseList = (courses ?? []) as AttendanceCourseOption[]

  return (
    <div className="space-y-6 p-2">
      <PageHeader
        title="ID card scan attendance"
        description="Select an offline session, then scan bound learner cards to mark present."
      />
      <AppCard className="p-2">
        <IdCardScanAttendanceClient courses={courseList} />
      </AppCard>
    </div>
  )
}
