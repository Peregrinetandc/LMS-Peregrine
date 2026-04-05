'use server'

import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { ensureSessionRosterRows } from '@/lib/ensure-session-roster'
import { resolveBoundLearnerForCourse } from '@/lib/offline-id-card-attendance'
import { requireScanAttendanceCourseAccess } from '@/lib/scan-attendance-access'

export type OfflineSessionOption = {
  id: string
  title: string
  week_index: number
  sort_order: number | null
}

export type IdCardScanAttendanceResult =
  | {
      ok: true
      learnerId: string
      learnerName: string | null
      learnerEmail: string | null
      wasAlreadyPresent: boolean
    }
  | { ok: false; code: string; message: string }

export async function listOfflineSessionsForCourse(
  courseId: string,
): Promise<{ sessions: OfflineSessionOption[] } | { error: string }> {
  const { supabase, user, error } = await requireScanAttendanceCourseAccess(courseId)
  if (!user || error) {
    return { error: error === 'NOT_SIGNED_IN' ? 'Not signed in.' : 'You do not have access.' }
  }

  const { data, error: qErr } = await supabase
    .from('modules')
    .select('id, title, week_index, sort_order')
    .eq('course_id', courseId)
    .eq('type', 'offline_session')
    .order('sort_order', { ascending: true })

  if (qErr) {
    return { error: qErr.message }
  }

  return { sessions: (data ?? []) as OfflineSessionOption[] }
}

/** Whether this offline session has attendance marked as submitted (same flag as manual hub). */
export async function getIdCardSessionSubmissionStatus(
  courseId: string,
  moduleId: string,
): Promise<{ submitted: boolean; submittedAt: string | null } | { error: string }> {
  const { supabase, user, error: accessErr } = await requireScanAttendanceCourseAccess(courseId)
  if (!user || accessErr) {
    return { error: accessErr === 'NOT_SIGNED_IN' ? 'Not signed in.' : 'You do not have access.' }
  }

  const { data: mod, error: modErr } = await supabase
    .from('modules')
    .select('id, type')
    .eq('id', moduleId)
    .eq('course_id', courseId)
    .single()

  if (modErr || !mod) {
    return { error: 'Session not found for this course.' }
  }
  if (mod.type !== 'offline_session') {
    return { error: 'Not an offline session.' }
  }

  const db = createAdminClient() ?? supabase

  const { data: row, error: rErr } = await db
    .from('module_session_roster')
    .select('roster_submitted_at')
    .eq('module_id', moduleId)
    .not('roster_submitted_at', 'is', null)
    .limit(1)
    .maybeSingle()

  if (rErr) {
    return { error: rErr.message }
  }

  const submittedAt = (row?.roster_submitted_at as string | null) ?? null
  return { submitted: submittedAt != null, submittedAt }
}

/** Set submission time on all roster rows for this session (like “Submit attendance” in manual entry). */
export async function finalizeIdCardSessionAttendance(input: {
  courseId: string
  moduleId: string
}): Promise<{ ok: true; submittedAt: string } | { error: string }> {
  const { supabase, user, error: accessErr } = await requireScanAttendanceCourseAccess(input.courseId)
  if (!user || accessErr) {
    return { error: accessErr === 'NOT_SIGNED_IN' ? 'Not signed in.' : 'You do not have access.' }
  }

  const { data: mod, error: modErr } = await supabase
    .from('modules')
    .select('id, course_id, type')
    .eq('id', input.moduleId)
    .eq('course_id', input.courseId)
    .single()

  if (modErr || !mod) {
    return { error: 'Session not found for this course.' }
  }
  if (mod.type !== 'offline_session') {
    return { error: 'Only offline sessions support ID card attendance.' }
  }

  const db = createAdminClient() ?? supabase

  const ensured = await ensureSessionRosterRows(db, input.moduleId, input.courseId)
  if (ensured.error) {
    return { error: ensured.error }
  }

  const ts = new Date().toISOString()
  const { error: upErr } = await db
    .from('module_session_roster')
    .update({ roster_submitted_at: ts, updated_at: ts })
    .eq('module_id', input.moduleId)

  if (upErr) {
    return { error: upErr.message }
  }

  return { ok: true, submittedAt: ts }
}

export async function recordIdCardAttendanceScan(input: {
  courseId: string
  moduleId: string
  publicCode: string
}): Promise<IdCardScanAttendanceResult> {
  const { supabase, user, error: accessErr } = await requireScanAttendanceCourseAccess(input.courseId)
  if (!user || accessErr) {
    return {
      ok: false,
      code: accessErr === 'NOT_SIGNED_IN' ? 'NOT_SIGNED_IN' : 'FORBIDDEN',
      message: accessErr === 'NOT_SIGNED_IN' ? 'Not signed in.' : 'You do not have access.',
    }
  }

  const { data: mod, error: modErr } = await supabase
    .from('modules')
    .select('id, course_id, type')
    .eq('id', input.moduleId)
    .eq('course_id', input.courseId)
    .single()

  if (modErr || !mod) {
    return { ok: false, code: 'INVALID_SESSION', message: 'Session not found for this course.' }
  }
  if (mod.type !== 'offline_session') {
    return { ok: false, code: 'NOT_OFFLINE_SESSION', message: 'Only offline sessions support ID card scan attendance.' }
  }

  /** After access checks, use service role so roster writes are not dropped by RLS/session edge cases. */
  const db = createAdminClient() ?? supabase

  const ensured = await ensureSessionRosterRows(db, input.moduleId, input.courseId)
  if (ensured.error) {
    return { ok: false, code: 'DB_ERROR', message: ensured.error }
  }

  const resolved = await resolveBoundLearnerForCourse(db, input.publicCode, input.courseId)
  if (!resolved.ok) {
    return { ok: false, code: resolved.code, message: resolved.message }
  }

  const learnerId = resolved.learnerId

  const { data: rosterRow, error: rErr } = await db
    .from('module_session_roster')
    .select('id, is_present')
    .eq('module_id', input.moduleId)
    .eq('learner_id', learnerId)
    .maybeSingle()

  if (rErr) {
    return { ok: false, code: 'DB_ERROR', message: rErr.message }
  }

  const wasAlreadyPresent = rosterRow?.is_present === true
  const ts = new Date().toISOString()

  if (rosterRow) {
    const { data: updatedRows, error: upErr } = await db
      .from('module_session_roster')
      .update({
        is_present: true,
        last_marked_by: user.id,
        updated_at: ts,
      })
      .eq('id', rosterRow.id as string)
      .select('id')

    if (upErr) {
      return { ok: false, code: 'DB_ERROR', message: upErr.message }
    }
    if (!updatedRows?.length) {
      return {
        ok: false,
        code: 'UPDATE_FAILED',
        message: 'Could not save attendance (no row updated). Check server configuration.',
      }
    }
  } else {
    const { data: inserted, error: insErr } = await db
      .from('module_session_roster')
      .insert({
        module_id: input.moduleId,
        learner_id: learnerId,
        is_present: true,
        last_marked_by: user.id,
        updated_at: ts,
      })
      .select('id')

    if (insErr) {
      return { ok: false, code: 'DB_ERROR', message: insErr.message }
    }
    if (!inserted?.length) {
      return {
        ok: false,
        code: 'INSERT_FAILED',
        message: 'Could not create roster row for this learner.',
      }
    }
  }

  const { data: prof } = await db
    .from('profiles')
    .select('full_name, email')
    .eq('id', learnerId)
    .maybeSingle()

  return {
    ok: true,
    learnerId,
    learnerName: (prof?.full_name as string | null) ?? null,
    learnerEmail: (prof?.email as string | null) ?? null,
    wasAlreadyPresent,
  }
}
