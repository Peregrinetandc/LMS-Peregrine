/**
 * Phase 4 (deferred) — scan-to-attendance using bound offline ID cards
 *
 * Contract for a future `lookupBoundLearnerForCourse` (or server action equivalent):
 *
 * 1. Input: normalized `public_code` (same format as bind: `ID-XXX-XXX`) and a `courseId`
 *    for the offline/live session module’s parent course.
 * 2. Resolve `offline_learner_id_cards` where `public_code` matches and `learner_id` is set.
 * 3. Reject if the card’s `course_id` is non-null and differs from the session’s `courseId`
 *    (same rule as bind’s `COURSE_MISMATCH`).
 * 4. Return `learner_id` only when bound and course is compatible; never leak other learners’
 *    bindings in error messages.
 * 5. Integrate with `module_session_roster`: after resolving `learner_id`, locate the roster row
 *    for the chosen offline module and update `is_present` / submission flow mirroring
 *    `SessionAttendanceClient` + `prepareSessionRoster` patterns.
 *
 * MVP scope stops at bind + IndexedDB outbox; attendance scanning reuses this contract.
 */

export type LookupBoundLearnerForCourseInput = {
  publicCode: string
  courseId: string
}

// Future: export async function lookupBoundLearnerForCourse(
//   input: LookupBoundLearnerForCourseInput,
// ): Promise<{ ok: true; learnerId: string } | { ok: false; code: string; message: string }> { ... }
