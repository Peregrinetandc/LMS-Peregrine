import type { SupabaseClient } from '@supabase/supabase-js'

/** Create roster rows for all enrolled learners (default absent; manual UI defaults Present until submit). */
export async function ensureSessionRosterRows(
  supabase: SupabaseClient,
  moduleId: string,
  courseId: string,
): Promise<{ error?: string }> {
  const { data: ens, error: ensErr } = await supabase
    .from('enrollments')
    .select('learner_id')
    .eq('course_id', courseId)
  if (ensErr) return { error: ensErr.message }

  const { data: existing, error: exErr } = await supabase
    .from('module_session_roster')
    .select('learner_id')
    .eq('module_id', moduleId)
  if (exErr) return { error: exErr.message }

  const have = new Set((existing ?? []).map((r) => r.learner_id as string))
  const toAdd = (ens ?? [])
    .filter((e) => !have.has(e.learner_id as string))
    .map((e) => ({
      module_id: moduleId,
      learner_id: e.learner_id as string,
      is_present: false,
    }))

  if (toAdd.length === 0) return {}

  const { error: insErr } = await supabase.from('module_session_roster').insert(toAdd)
  if (insErr) return { error: insErr.message }
  return {}
}
