/**
 * Nested `modules → assignments` selects: PostgREST usually returns an array of rows.
 * With a one-to-one-style FK (e.g. unique module_id on assignments), the client may return a single object instead.
 * Always normalize before reading `[0]`.
 *
 * Call sites: `CourseBuilder` (map from DB), `grading/actions.ts` (embedded ids),
 * `courses/.../modules/[moduleId]/page.tsx` (lesson preview). Dashboard due-assignments
 * already normalizes array vs object inline.
 */
export type EmbeddedAssignmentRow = {
  id: string
  description?: string | null
  max_score?: number
  passing_score?: number
  deadline_at?: string | null
  allow_late?: boolean
}

export function firstEmbeddedAssignment(raw: unknown): EmbeddedAssignmentRow | null {
  if (raw == null) return null
  if (Array.isArray(raw)) {
    const row = raw[0]
    if (row && typeof row === 'object' && 'id' in row) {
      return row as EmbeddedAssignmentRow
    }
    return null
  }
  if (typeof raw === 'object' && 'id' in raw) {
    return raw as EmbeddedAssignmentRow
  }
  return null
}
