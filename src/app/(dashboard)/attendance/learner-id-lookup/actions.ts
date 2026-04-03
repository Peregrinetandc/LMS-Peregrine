'use server'

import { createClient } from '@/utils/supabase/server'
import {
  normalizeOfflinePublicCode,
  OFFLINE_ID_CODE_RE,
} from '@/lib/offline-id-card'

export type LearnerIdCourseInfo = {
  id: string
  title: string
  course_code: string
}

export type LearnerIdProfileInfo = {
  id: string
  full_name: string | null
  email: string | null
}

export type LookupLearnerByIdCardResult =
  | {
      ok: true
      bound: false
      publicCode: string
      course: LearnerIdCourseInfo | null
    }
  | {
      ok: true
      bound: true
      publicCode: string
      course: LearnerIdCourseInfo | null
      learner: LearnerIdProfileInfo
    }
  | { ok: false; code: string; message: string }

export async function lookupLearnerByIdCard(publicCode: string): Promise<LookupLearnerByIdCardResult> {
  const normalized = normalizeOfflinePublicCode(publicCode)
  if (!OFFLINE_ID_CODE_RE.test(normalized)) {
    return { ok: false, code: 'INVALID_CODE', message: 'Code must look like ID-ABC-XYZ.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, code: 'NOT_SIGNED_IN', message: 'Not signed in.' }
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const role = profile?.role ?? 'learner'
  if (role !== 'instructor' && role !== 'admin') {
    return { ok: false, code: 'FORBIDDEN', message: 'You do not have access.' }
  }

  const { data: row, error } = await supabase
    .from('offline_learner_id_cards')
    .select(
      `
      public_code,
      course_id,
      learner_id,
      courses ( id, title, course_code )
    `,
    )
    .eq('public_code', normalized)
    .maybeSingle()

  if (error) {
    return { ok: false, code: 'DB_ERROR', message: error.message }
  }
  if (!row) {
    return { ok: false, code: 'CARD_NOT_FOUND', message: 'No card found for this code (or you cannot access it).' }
  }

  const courseEmbed = row.courses as unknown
  const courseRow = Array.isArray(courseEmbed) ? courseEmbed[0] : courseEmbed
  const courseIdFallback = row.course_id as string | null
  const course: LearnerIdCourseInfo | null =
    courseRow &&
    typeof courseRow === 'object' &&
    courseRow !== null &&
    'id' in courseRow &&
    (courseRow as { id: unknown }).id
      ? {
          id: String((courseRow as { id: unknown }).id),
          title: String((courseRow as { title?: unknown }).title ?? ''),
          course_code: String((courseRow as { course_code?: unknown }).course_code ?? ''),
        }
      : courseIdFallback
        ? { id: courseIdFallback, title: '(course unavailable)', course_code: '' }
        : null

  const learnerId = row.learner_id as string | null
  if (!learnerId) {
    return {
      ok: true,
      bound: false,
      publicCode: normalized,
      course,
    }
  }

  const { data: learnerRow, error: pErr } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('id', learnerId)
    .maybeSingle()

  if (pErr) {
    return { ok: false, code: 'DB_ERROR', message: pErr.message }
  }
  if (!learnerRow) {
    return {
      ok: false,
      code: 'PROFILE_HIDDEN',
      message:
        "This card is bound, but you do not have permission to view this learner's profile (or the profile is missing).",
    }
  }

  return {
    ok: true,
    bound: true,
    publicCode: normalized,
    course,
    learner: {
      id: learnerRow.id as string,
      full_name: learnerRow.full_name as string | null,
      email: learnerRow.email as string | null,
    },
  }
}
