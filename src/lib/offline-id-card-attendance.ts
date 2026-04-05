import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeOfflinePublicCode, OFFLINE_ID_CODE_RE } from '@/lib/offline-id-card'

export type ResolveBoundLearnerResult =
  | { ok: true; learnerId: string }
  | { ok: false; code: string; message: string }

/**
 * Resolve a bound physical ID card to a learner for the given course (must be enrolled).
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
    .select('learner_id')
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

  const learnerId = card.learner_id as string

  const { data: enrollment, error: enrErr } = await supabase
    .from('enrollments')
    .select('id')
    .eq('course_id', courseId)
    .eq('learner_id', learnerId)
    .maybeSingle()

  if (enrErr) {
    return { ok: false, code: 'DB_ERROR', message: enrErr.message }
  }
  if (!enrollment) {
    return {
      ok: false,
      code: 'NOT_ENROLLED',
      message: 'This learner is not enrolled in the selected course.',
    }
  }

  return { ok: true, learnerId }
}
