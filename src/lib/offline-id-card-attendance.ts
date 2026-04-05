import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeOfflinePublicCode, OFFLINE_ID_CODE_RE } from '@/lib/offline-id-card'

export type ResolveBoundLearnerResult =
  | { ok: true; learnerId: string }
  | { ok: false; code: string; message: string }

/**
 * Resolve a bound physical ID card to a learner for the given course (bind rules).
 */
export async function resolveBoundLearnerForCourse(
  supabase: SupabaseClient,
  publicCodeRaw: string,
  courseId: string,
): Promise<ResolveBoundLearnerResult> {
  const normalized = normalizeOfflinePublicCode(publicCodeRaw)
  if (!OFFLINE_ID_CODE_RE.test(normalized)) {
    return { ok: false, code: 'INVALID_CODE', message: 'Code must look like ID-ABC-XYZ.' }
  }

  const { data: card, error } = await supabase
    .from('offline_learner_id_cards')
    .select('learner_id, course_id')
    .eq('public_code', normalized)
    .maybeSingle()

  if (error) {
    return { ok: false, code: 'DB_ERROR', message: error.message }
  }
  if (!card) {
    return { ok: false, code: 'CARD_NOT_FOUND', message: 'No card found for this code.' }
  }
  if (!card.learner_id) {
    return { ok: false, code: 'NOT_BOUND', message: 'This card is not bound to a learner.' }
  }

  const existingCourseId = card.course_id as string | null
  if (existingCourseId != null && existingCourseId !== courseId) {
    return {
      ok: false,
      code: 'COURSE_MISMATCH',
      message: 'This card is reserved for a different course.',
    }
  }

  return { ok: true, learnerId: card.learner_id as string }
}
