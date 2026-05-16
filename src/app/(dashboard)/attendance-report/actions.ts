'use server'

import { ensureSessionRosterRows } from '@/lib/ensure-session-roster'
import { ROLES } from '@/lib/roles'
import { requireRoleAction } from '@/lib/auth/require-role'
import type {
  AttendanceModuleDetailPagination,
  AttendanceReportFilters,
  AttendanceReportRow,
  AttendanceSessionListItem,
  AttendanceSessionTypeFilter,
} from './types'

const DEFAULT_DETAIL_PAGE_SIZE = 50
const MAX_DETAIL_PAGE_SIZE = 200
/** Chunk size for module id lists (RPC + fallback). Keeps request payloads modest. */
const MODULE_ID_CHUNK = 120

function normalizeSessionType(sessionType: AttendanceSessionTypeFilter): 'all' | 'live_session' | 'offline_session' {
  if (sessionType === 'live_session' || sessionType === 'offline_session') return sessionType
  return 'all'
}

function parseDayStartIso(dateStr: string): string | null {
  const s = dateStr.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  return `${s}T00:00:00.000Z`
}

function parseDayEndIso(dateStr: string): string | null {
  const s = dateStr.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  return `${s}T23:59:59.999Z`
}

function clampDetailPagination(page: number, pageSize: number) {
  const p = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1
  const raw = Number.isFinite(pageSize) ? Math.floor(pageSize) : DEFAULT_DETAIL_PAGE_SIZE
  const ps = Math.min(MAX_DETAIL_PAGE_SIZE, Math.max(10, raw))
  return { page: p, pageSize: ps }
}

function hasRestrictiveRosterFilters(filters: AttendanceReportFilters, learnerIdsFilter: string[] | null): boolean {
  if (learnerIdsFilter && learnerIdsFilter.length > 0) return true
  if (parseDayStartIso(filters.fromDate ?? '')) return true
  if (parseDayEndIso(filters.toDate ?? '')) return true
  if ((filters.presence ?? 'all') !== 'all') return true
  return false
}

type SessionListResult = { sessions: AttendanceSessionListItem[] } | { error: string }

export async function fetchAttendanceSessionList(filters: AttendanceReportFilters): Promise<SessionListResult> {
  const gate = await requireRoleAction('instructor')
  if (!gate.ok) return { error: gate.reason === 'unauth' ? 'Not signed in' : 'Forbidden' }
  const { user, role, supabase } = gate

  let coursesQuery = supabase.from('courses').select('id, title, course_code').order('title')
  if (role !== ROLES.ADMIN) coursesQuery = coursesQuery.eq('instructor_id', user.id)
  const { data: allowedCourses, error: cErr } = await coursesQuery
  if (cErr) return { error: cErr.message }

  const allowedCourseIds = new Set((allowedCourses ?? []).map((c) => c.id as string))
  const courseFilter = filters.courseId ?? 'all'
  if (courseFilter !== 'all' && !allowedCourseIds.has(courseFilter)) {
    return { error: 'Forbidden' }
  }

  const courseIdsForModules = courseFilter === 'all' ? Array.from(allowedCourseIds) : [courseFilter]
  if (courseIdsForModules.length === 0) return { sessions: [] }

  const sessionType = normalizeSessionType(filters.sessionType)
  const presence = filters.presence ?? 'all'

  let modsQuery = supabase
    .from('modules')
    .select('id, title, type, week_index, course_id, sort_order')
    .in('course_id', courseIdsForModules)
    .in('type', sessionType === 'all' ? ['live_session', 'offline_session'] : [sessionType])
    .order('sort_order', { ascending: true })

  const { data: mods, error: mErr } = await modsQuery
  if (mErr) return { error: mErr.message }

  const moduleRows = (mods ?? []) as {
    id: string
    title: string
    type: string
    week_index: number | null
    course_id: string
    sort_order: number | null
  }[]

  if (moduleRows.length === 0) return { sessions: [] }

  const moduleById = new Map(
    moduleRows.map((m) => [
      m.id,
      {
        moduleId: m.id,
        moduleTitle: m.title,
        moduleType:
          m.type === 'offline_session' ? ('offline_session' as const) : ('live_session' as const),
        weekIndex: m.week_index ?? 1,
        sortOrder: m.sort_order ?? 0,
        courseId: m.course_id,
      },
    ]),
  )

  const courseById = new Map(
    (allowedCourses ?? []).map((c: { id: string; title?: string; course_code?: string }) => [
      c.id as string,
      { courseTitle: (c.title as string) ?? 'Course', courseCode: (c.course_code as string) ?? '' },
    ]),
  )

  const learnerQuery = (filters.learnerQuery ?? '').trim()
  let learnerIdsFilter: string[] | null = null
  if (learnerQuery) {
    const { data: matches, error: pErr } = await supabase
      .from('profiles')
      .select('id')
      .ilike('full_name', `%${learnerQuery}%`)
      .limit(100)
    if (pErr) return { error: pErr.message }
    learnerIdsFilter = (matches ?? []).map((m) => m.id as string)
    if (learnerIdsFilter.length === 0) return { sessions: [] }
  }

  const restrictive = hasRestrictiveRosterFilters(filters, learnerIdsFilter)

  const fromIso = parseDayStartIso(filters.fromDate ?? '')
  const toIso = parseDayEndIso(filters.toDate ?? '')

  function applyRosterFilters(q: any, moduleIdsList: string[]) {
    let rosterQuery = q.in('module_id', moduleIdsList)
    if (presence === 'present') rosterQuery = rosterQuery.eq('is_present', true)
    if (presence === 'absent') rosterQuery = rosterQuery.eq('is_present', false)
    if (learnerIdsFilter) rosterQuery = rosterQuery.in('learner_id', learnerIdsFilter)
    if (fromIso) rosterQuery = rosterQuery.gte('roster_submitted_at', fromIso)
    if (toIso) rosterQuery = rosterQuery.lte('roster_submitted_at', toIso)
    return rosterQuery
  }

  const moduleIds = moduleRows.map((m) => m.id)
  const byModule = new Map<
    string,
    { total: number; present: number; absent: number; submittedAt: string | null }
  >()
  for (const mid of moduleIds) {
    byModule.set(mid, { total: 0, present: 0, absent: 0, submittedAt: null })
  }

  const presenceArg = presence === 'present' ? 'present' : presence === 'absent' ? 'absent' : 'all'

  function rpcMissingError(e: { message?: string; code?: string } | null): boolean {
    if (!e) return false
    return (
      e.code === 'PGRST202' ||
      e.code === '42883' ||
      (e.message?.includes('attendance_report_session_aggregates_v1') ?? false) ||
      (e.message?.includes('Could not find') ?? false)
    )
  }

  let fallbackScan = false
  for (let i = 0; i < moduleIds.length; i += MODULE_ID_CHUNK) {
    const chunk = moduleIds.slice(i, i + MODULE_ID_CHUNK)
    const { data: rpcRows, error: rpcErr } = await supabase.rpc('attendance_report_session_aggregates_v1', {
      p_module_ids: chunk,
      p_presence: presenceArg,
      p_learner_ids: learnerIdsFilter ?? null,
      p_from: fromIso,
      p_to: toIso,
    })

    if (rpcErr) {
      if (rpcMissingError(rpcErr)) {
        fallbackScan = true
        break
      }
      return { error: rpcErr.message }
    }

    for (const raw of (rpcRows ?? []) as {
      module_id: string
      total: number | string
      present: number | string
      absent: number | string
      submitted_at_max: string | null
    }[]) {
      const acc = byModule.get(raw.module_id)
      if (!acc) continue
      acc.total = Number(raw.total)
      acc.present = Number(raw.present)
      acc.absent = Number(raw.absent)
      acc.submittedAt = raw.submitted_at_max ?? null
    }
  }

  if (fallbackScan) {
    for (const mid of moduleIds) {
      byModule.set(mid, { total: 0, present: 0, absent: 0, submittedAt: null })
    }
    for (let i = 0; i < moduleIds.length; i += MODULE_ID_CHUNK) {
      const chunk = moduleIds.slice(i, i + MODULE_ID_CHUNK)
      const rosterQuery = applyRosterFilters(
        supabase.from('module_session_roster').select('module_id, is_present, roster_submitted_at'),
        chunk,
      )
      const { data: aggRows, error: aggErr } = await rosterQuery
      if (aggErr) return { error: aggErr.message }

      for (const raw of aggRows ?? []) {
        const row = raw as {
          module_id: string
          is_present: boolean
          roster_submitted_at: string | null
        }
        const acc = byModule.get(row.module_id)
        if (!acc) continue
        acc.total += 1
        if (row.is_present) acc.present += 1
        else acc.absent += 1
        if (row.roster_submitted_at) {
          if (!acc.submittedAt || new Date(row.roster_submitted_at) > new Date(acc.submittedAt)) {
            acc.submittedAt = row.roster_submitted_at
          }
        }
      }
    }
  }

  const sessions: AttendanceSessionListItem[] = []

  for (const m of moduleRows) {
    const mod = moduleById.get(m.id)
    if (!mod) continue
    const acc = byModule.get(m.id)
    if (!acc) continue

    if (restrictive && acc.total === 0) continue

    const courseMeta = courseById.get(mod.courseId)
    const submittedAt = acc.submittedAt

    sessions.push({
      courseId: mod.courseId,
      courseTitle: courseMeta?.courseTitle ?? 'Course',
      courseCode: courseMeta?.courseCode ?? '',
      moduleId: mod.moduleId,
      moduleTitle: mod.moduleTitle,
      moduleType: mod.moduleType,
      weekIndex: mod.weekIndex,
      sortOrder: mod.sortOrder,
      submittedAt,
      total: acc.total,
      present: acc.present,
      absent: acc.absent,
    })
  }

  sessions.sort((a, b) => {
    const c = a.courseTitle.localeCompare(b.courseTitle)
    if (c !== 0) return c
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
    if (a.weekIndex !== b.weekIndex) return a.weekIndex - b.weekIndex
    return a.moduleTitle.localeCompare(b.moduleTitle)
  })

  return { sessions }
}

type ModuleDetailResult =
  | {
      rows: AttendanceReportRow[]
      totalCount: number
      page: number
      pageSize: number
    }
  | { error: string }

export async function fetchAttendanceModuleDetail({
  courseId,
  moduleId,
  filters,
  pagination,
}: {
  courseId: string
  moduleId: string
  filters: AttendanceReportFilters
  pagination: AttendanceModuleDetailPagination
}): Promise<ModuleDetailResult> {
  const { page, pageSize } = clampDetailPagination(pagination.page, pagination.pageSize)
  const gate = await requireRoleAction('instructor')
  if (!gate.ok) return { error: gate.reason === 'unauth' ? 'Not signed in' : 'Forbidden' }
  const { user, role, supabase } = gate

  const { data: course, error: cErr } = await supabase
    .from('courses')
    .select('instructor_id, title, course_code')
    .eq('id', courseId)
    .single()
  if (cErr || !course) return { error: cErr?.message ?? 'Course not found' }
  if (role !== ROLES.ADMIN && course.instructor_id !== user.id) return { error: 'Forbidden' }

  const { data: mod, error: mErr } = await supabase
    .from('modules')
    .select('id, type, title, week_index, course_id')
    .eq('id', moduleId)
    .eq('course_id', courseId)
    .single()
  if (mErr || !mod) return { error: mErr?.message ?? 'Module not found' }
  if (mod.type !== 'live_session' && mod.type !== 'offline_session') {
    return { error: 'Invalid session lesson' }
  }

  const ensured = await ensureSessionRosterRows(supabase, moduleId, courseId)
  if (ensured.error) return { error: ensured.error }

  const presence = filters.presence ?? 'all'
  const learnerQuery = (filters.learnerQuery ?? '').trim()
  let learnerIdsFilter: string[] | null = null
  if (learnerQuery) {
    const { data: matches, error: pErr } = await supabase
      .from('profiles')
      .select('id')
      .ilike('full_name', `%${learnerQuery}%`)
      .limit(100)
    if (pErr) return { error: pErr.message }
    learnerIdsFilter = (matches ?? []).map((m) => m.id as string)
    if (learnerIdsFilter.length === 0) {
      return { rows: [], totalCount: 0, page: 1, pageSize }
    }
  }

  function applyDetailFilters(q: any) {
    let rosterQuery = q.eq('module_id', moduleId)
    if (presence === 'present') rosterQuery = rosterQuery.eq('is_present', true)
    if (presence === 'absent') rosterQuery = rosterQuery.eq('is_present', false)
    if (learnerIdsFilter) rosterQuery = rosterQuery.in('learner_id', learnerIdsFilter)
    const fromIso = parseDayStartIso(filters.fromDate ?? '')
    const toIso = parseDayEndIso(filters.toDate ?? '')
    if (fromIso) rosterQuery = rosterQuery.gte('roster_submitted_at', fromIso)
    if (toIso) rosterQuery = rosterQuery.lte('roster_submitted_at', toIso)
    return rosterQuery
  }

  const countQuery = applyDetailFilters(
    supabase.from('module_session_roster').select('id', { count: 'exact', head: true }),
  )
  const { count: totalCountRaw, error: countErr } = await countQuery
  if (countErr) return { error: countErr.message }

  const totalCount = totalCountRaw ?? 0
  if (totalCount === 0) {
    return { rows: [], totalCount: 0, page: 1, pageSize }
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const safePage = Math.min(page, totalPages)
  const fromIdx = (safePage - 1) * pageSize
  const toIdx = fromIdx + pageSize - 1

  const rosterQuery = applyDetailFilters(
    supabase
      .from('module_session_roster')
      .select('id, module_id, learner_id, is_present, roster_submitted_at, updated_at'),
  )

  const { data: roster, error: rErr } = await rosterQuery
    .order('learner_id', { ascending: true })
    .range(fromIdx, toIdx)
  if (rErr) return { error: rErr.message }

  const rosterList = (roster ?? []) as {
    id: string
    module_id: string
    learner_id: string
    is_present: boolean
    roster_submitted_at: string | null
    updated_at: string | null
  }[]

  const learnerIds = rosterList.map((r) => r.learner_id)
  const { data: profs, error: pErr } =
    learnerIds.length > 0
      ? await supabase.from('profiles').select('id, full_name').in('id', learnerIds)
      : { data: [], error: null }
  if (pErr) return { error: pErr.message }

  const learnerNameById = new Map(
    (profs ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name]),
  )

  const moduleType = mod.type === 'offline_session' ? 'offline_session' : 'live_session'
  const courseTitle = (course.title as string) ?? 'Course'
  const courseCode = (course.course_code as string) ?? ''

  const rows: AttendanceReportRow[] = rosterList.map((r) => ({
    moduleId,
    moduleTitle: (mod.title as string) ?? '',
    moduleType,
    weekIndex: (mod.week_index as number) ?? 1,
    courseId,
    courseTitle,
    courseCode,
    rosterRowId: r.id,
    learnerId: r.learner_id,
    learnerName: learnerNameById.get(r.learner_id) ?? null,
    isPresent: !!r.is_present,
    rosterSubmittedAt: r.roster_submitted_at ?? null,
    updatedAt: r.updated_at ?? null,
  }))

  return { rows, totalCount, page: safePage, pageSize }
}
