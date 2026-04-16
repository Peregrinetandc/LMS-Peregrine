import { createClient } from '@/utils/supabase/server'
import {
  CourseCatalog,
  type CatalogCourse,
} from '@/components/courses/course-catalog'
import { isInstructorRole } from '@/lib/roles'

export default async function CoursesPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: viewerProfile } = user
    ? await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    : { data: null as { role: string } | null }

  const seesAllCatalog = isInstructorRole(viewerProfile?.role)

  const catalogSelect = `
    id, course_code, title, description, thumbnail_url, enrollment_type, created_at,
    profiles:instructor_id ( full_name )
  `

  let courses: CatalogCourse[] = []

  if (seesAllCatalog) {
    const { data } = await supabase
      .from('courses')
      .select(catalogSelect)
      .eq('status', 'published')
      .order('created_at', { ascending: false })
    courses = (data ?? []) as CatalogCourse[]
  } else {
    /** Learners: open catalog + invite-only courses they are enrolled in (e.g. via Apps Script). */
    const enrolledIds: string[] = []
    if (user) {
      const { data: ens } = await supabase
        .from('enrollments')
        .select('course_id')
        .eq('learner_id', user.id)
      for (const row of ens ?? []) {
        enrolledIds.push((row as { course_id: string }).course_id)
      }
    }

    const { data: openCourses } = await supabase
      .from('courses')
      .select(catalogSelect)
      .eq('status', 'published')
      .eq('enrollment_type', 'open')
      .order('created_at', { ascending: false })

    let invitedCourses: CatalogCourse[] = []
    if (enrolledIds.length > 0) {
      const { data: inv } = await supabase
        .from('courses')
        .select(catalogSelect)
        .eq('status', 'published')
        .eq('enrollment_type', 'invite_only')
        .in('id', enrolledIds)
        .order('created_at', { ascending: false })
      invitedCourses = (inv ?? []) as CatalogCourse[]
    }

    const byId = new Map<string, CatalogCourse>()
    for (const c of [...(openCourses ?? []), ...invitedCourses] as CatalogCourse[]) {
      byId.set(c.id, c)
    }
    courses = [...byId.values()].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
  }

  return (
    <div className="px-2 pb-8 pt-2 sm:px-0 sm:pb-10 sm:pt-0">
      <CourseCatalog courses={courses} />
    </div>
  )
}
