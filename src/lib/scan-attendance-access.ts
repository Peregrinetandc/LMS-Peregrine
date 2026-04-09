import { createClient } from '@/utils/supabase/server'
import { ROLES, isStaffRole } from '@/lib/roles'

/** Same course scope as bind-cards: admin + coordinator = any course; instructor = own only. */
export async function requireScanAttendanceCourseAccess(courseId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { supabase, user: null as null, error: 'NOT_SIGNED_IN' as const }
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const role = profile?.role ?? ROLES.LEARNER
  if (!isStaffRole(role)) {
    return { supabase, user, error: 'FORBIDDEN' as const }
  }

  const { data: course } = await supabase.from('courses').select('instructor_id').eq('id', courseId).single()
  if (!course) {
    return { supabase, user, error: 'FORBIDDEN' as const }
  }
  if (role !== ROLES.ADMIN && role !== ROLES.COORDINATOR && course.instructor_id !== user.id) {
    return { supabase, user, error: 'FORBIDDEN' as const }
  }

  return { supabase, user, error: null as null }
}
