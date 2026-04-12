import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import GradingClient from './GradingClient'
import { PageHeader } from '@/components/ui/primitives'
import { ROLES, isStaffRole } from '@/lib/roles'
import { fetchGradingData, type GradingCourseOption } from './actions'

export default async function GradingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single()
  const role = profile?.role ?? ROLES.LEARNER
  if (!isStaffRole(role)) {
    redirect('/unauthorized')
  }

  let coursesQuery = supabase.from('courses').select('id, title, course_code').order('title')
  if (role === ROLES.INSTRUCTOR) {
    coursesQuery = coursesQuery.eq('instructor_id', user.id)
  }
  const { data: courses } = await coursesQuery

  const initialFilters = {
    courseId: 'all',
    status: 'turned_in' as const,
    learnerQuery: '',
  }
  const initialPagination = { page: 1, pageSize: 100 }
  const res = await fetchGradingData(initialFilters, initialPagination)

  if ('error' in res) {
    return <div className="p-4 text-red-600">Error: {res.error}</div>
  }

  return (
    <div className="space-y-6 p-2">
      <PageHeader
        title="Grading hub"
        description="Review and grade student assignment submissions across your courses."
      />
      <GradingClient
        courses={(courses ?? []) as GradingCourseOption[]}
        initialRows={res.rows}
        initialTotalCount={res.totalCount}
      />
    </div>
  )
}
