import { createClient } from '@/utils/supabase/server'

/** Same course scope as bind-cards: admin + card_coordinator = any course; instructor = own only. */
export async function requireScanAttendanceCourseAccess(courseId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { supabase, user: null as null, error: 'NOT_SIGNED_IN' as const }
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const role = profile?.role ?? 'learner'
  if (role !== 'instructor' && role !== 'admin' && role !== 'card_coordinator') {
    return { supabase, user, error: 'FORBIDDEN' as const }
  }

  const { data: course } = await supabase.from('courses').select('instructor_id').eq('id', courseId).single()
  if (!course) {
    return { supabase, user, error: 'FORBIDDEN' as const }
  }
  if (role !== 'admin' && role !== 'card_coordinator' && course.instructor_id !== user.id) {
    return { supabase, user, error: 'FORBIDDEN' as const }
  }

  return { supabase, user, error: null as null }
}
