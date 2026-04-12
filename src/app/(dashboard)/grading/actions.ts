'use server'

import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { ROLES, isStaffRole } from '@/lib/roles'
import { revalidatePath } from 'next/cache'

const SUPABASE_IN_CHUNK = 40

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

export type GradingRow = {
  submissionId: string
  assignmentId: string
  learnerId: string
  learnerName: string | null
  courseId: string
  courseTitle: string
  courseCode: string
  moduleTitle: string
  moduleType: string
  maxScore: number
  passingScore: number
  isTurnedIn: boolean
  turnedInAt: string | null
  submittedAt: string
  score: number | null
  feedback: string | null
  gradedAt: string | null
  isPassed: boolean | null
  primaryFileUrl: string | null
  files: { url: string; name: string }[]
}

export type GradingFilters = {
  courseId: string | 'all'
  status: 'all' | 'turned_in' | 'draft' | 'graded'
  learnerQuery: string
}

export type GradingPagination = {
  page: number
  pageSize: number
}

export type GradingCourseOption = {
  id: string
  title: string
  course_code: string
}

export async function fetchGradingData(filters: GradingFilters, pagination: GradingPagination): Promise<{
  rows: GradingRow[]
  totalCount: number
  page: number
  pageSize: number
} | { error: string }> {
  const supabase = await createClient()
  const admin = createAdminClient()
  const db = admin ?? supabase
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const role = profile?.role ?? ROLES.LEARNER
  if (!isStaffRole(role)) return { error: 'Forbidden' }

  const { page, pageSize } = pagination
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  // Resolve instructor courses if needed
  let allowedCourseIds: string[] | null = null
  if (role === ROLES.INSTRUCTOR) {
    const { data: instructorCourses } = await db.from('courses').select('id').eq('instructor_id', user.id)
    allowedCourseIds = (instructorCourses ?? []).map((c) => c.id)
  }

  // Resolve learner search if provided
  let learnerIdsFilter: string[] | null = null
  if (filters.learnerQuery) {
    const { data: matches } = await db
      .from('profiles')
      .select('id')
      .ilike('full_name', `%${filters.learnerQuery}%`)
      .limit(100)
    learnerIdsFilter = (matches ?? []).map((m) => m.id)
    if (learnerIdsFilter.length === 0) {
      return { rows: [], totalCount: 0, page: 1, pageSize }
    }
  }

  let subsQuery = db
    .from('submissions')
    .select(
      'id, assignment_id, learner_id, is_turned_in, turned_in_at, submitted_at, score, feedback, graded_at, is_passed, file_url',
      { count: 'exact' }
    )
    .order('submitted_at', { ascending: false })

  // Apply filters
  if (filters.courseId !== 'all') {
    // If it's a specific course, we need to find assignments for that course
    const { data: courseAssignments } = await db.from('modules')
      .select('assignments(id)')
      .eq('course_id', filters.courseId)
    const assignmentIds = (courseAssignments ?? [])
      .flatMap(m => (m as any).assignments ?? [])
      .map((a: any) => a.id)
    subsQuery = subsQuery.in('assignment_id', assignmentIds)
  } else if (allowedCourseIds) {
    // Restrict to instructor courses
    const { data: instructorAssignments } = await db.from('modules')
      .select('assignments(id)')
      .in('course_id', allowedCourseIds)
    const assignmentIds = (instructorAssignments ?? [])
      .flatMap(m => (m as any).assignments ?? [])
      .map((a: any) => a.id)
    subsQuery = subsQuery.in('assignment_id', assignmentIds)
  }

  if (filters.status === 'graded') {
    subsQuery = subsQuery.not('graded_at', 'is', null)
  } else if (filters.status === 'turned_in') {
    subsQuery = subsQuery.eq('is_turned_in', true).is('graded_at', null)
  } else if (filters.status === 'draft') {
    subsQuery = subsQuery.eq('is_turned_in', false).is('graded_at', null)
  }

  if (learnerIdsFilter) {
    subsQuery = subsQuery.in('learner_id', learnerIdsFilter)
  }

  const { data: subs, count, error: subsErr } = await subsQuery.range(from, to)
  if (subsErr) return { error: subsErr.message }

  const submissionList = subs ?? []
  const assignmentIds = [...new Set(submissionList.map((s) => s.assignment_id))]

  const assignmentMap = new Map<string, any>()
  if (assignmentIds.length > 0) {
    const { data: asns } = await db
      .from('assignments')
      .select('id, max_score, passing_score, module_id')
      .in('id', assignmentIds)

    const moduleIds = [...new Set((asns ?? []).map((a) => a.module_id))]
    const { data: mods } = await db
      .from('modules')
      .select('id, title, type, course_id')
      .in('id', moduleIds)

    const courseIds = [...new Set((mods ?? []).map((m) => m.course_id))]
    const { data: crs } = await db.from('courses').select('id, title, course_code').in('id', courseIds)

    const courseMeta = new Map((crs ?? []).map((c) => [c.id, { title: c.title, courseCode: c.course_code }]))
    const modById = new Map((mods ?? []).map((m) => {
      const meta = courseMeta.get(m.course_id)
      return [m.id, { title: m.title, type: m.type, courseId: m.course_id, courseTitle: meta?.title ?? 'Course', courseCode: meta?.courseCode ?? '' }]
    }))

    for (const a of asns ?? []) {
      const m = modById.get(a.module_id)
      if (!m) continue
      assignmentMap.set(a.id, { ...a, ...m })
    }
  }

  const learnerIds = [...new Set(submissionList.map((s) => s.learner_id))]
  const nameByLearner = new Map<string, string | null>()
  for (const idChunk of chunkArray(learnerIds, SUPABASE_IN_CHUNK)) {
    const { data: profs } = await db.from('profiles').select('id, full_name').in('id', idChunk)
    for (const p of profs ?? []) nameByLearner.set(p.id, p.full_name)
  }

  const subIds = submissionList.map((s) => s.id)
  const filesBySub = new Map<string, { url: string; name: string }[]>()
  if (subIds.length > 0) {
    for (const idChunk of chunkArray(subIds, SUPABASE_IN_CHUNK)) {
      const { data: sfiles } = await db
        .from('submission_files')
        .select('submission_id, file_url, original_name')
        .in('submission_id', idChunk)
      for (const f of sfiles ?? []) {
        const arr = filesBySub.get(f.submission_id) ?? []
        arr.push({ url: f.file_url, name: f.original_name ?? 'File' })
        filesBySub.set(f.submission_id, arr)
      }
    }
  }

  const rows: GradingRow[] = submissionList.map((s) => {
    const asn = assignmentMap.get(s.assignment_id)
    return {
      submissionId: s.id,
      assignmentId: s.assignment_id,
      learnerId: s.learner_id,
      learnerName: nameByLearner.get(s.learner_id) ?? null,
      courseId: asn?.courseId ?? '',
      courseTitle: asn?.courseTitle ?? 'Course',
      courseCode: asn?.courseCode ?? '',
      moduleTitle: asn?.title ?? 'Lesson',
      moduleType: asn?.moduleType ?? '',
      maxScore: asn?.max_score ?? 100,
      passingScore: asn?.passing_score ?? 60,
      isTurnedIn: s.is_turned_in,
      turnedInAt: s.turned_in_at,
      submittedAt: s.submitted_at,
      score: s.score,
      feedback: s.feedback,
      gradedAt: s.graded_at,
      isPassed: s.is_passed,
      primaryFileUrl: s.file_url,
      files: filesBySub.get(s.id) ?? [],
    }
  })

  return {
    rows,
    totalCount: count ?? 0,
    page,
    pageSize,
  }
}

export async function bulkUpdateGrades(grades: { submissionId: string, score: number, feedback: string | null }[]) {
  const supabase = await createClient()
  const admin = createAdminClient()
  const db = admin ?? supabase
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const role = profile?.role ?? ROLES.LEARNER
  if (!isStaffRole(role)) return { error: 'Forbidden' }

  // We need passing_score to set is_passed correctly
  const subIds = grades.map(g => g.submissionId)
  const { data: subsData } = await db
    .from('submissions')
    .select('id, assignment_id')
    .in('id', subIds)
  
  const asnIds = [...new Set((subsData ?? []).map(s => s.assignment_id))]
  const { data: asnsData } = await db
    .from('assignments')
    .select('id, passing_score')
    .in('id', asnIds)
  
  const asnMap = new Map((asnsData ?? []).map(a => [a.id, a.passing_score]))
  const subToAsn = new Map((subsData ?? []).map(s => [s.id, s.assignment_id]))

  const ts = new Date().toISOString()
  const updates = grades.map((g) => {
    const asnId = subToAsn.get(g.submissionId)
    const passingScore = asnId ? asnMap.get(asnId) ?? 60 : 60
    return {
      submissionId: g.submissionId,
      score: g.score,
      feedback: g.feedback,
      gradedAt: ts,
      isPassed: g.score >= passingScore,
    }
  })

  const { error } = await db.rpc('bulk_update_submissions_v1', {
    p_updates: updates
  })
  if (error) return { error: error.message }

  revalidatePath('/grading')
  return { ok: true }
}
