type MaybeArray<T> = T | T[] | null | undefined

function firstRow<T>(value: MaybeArray<T>): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

export function getModuleContentUrl(row: Record<string, unknown>): string {
  const content = firstRow(row.module_content as MaybeArray<{ content_url?: string | null }>)
  return content?.content_url ?? ''
}

export function getModuleSessionFields(row: Record<string, unknown>) {
  const session = firstRow(
    row.module_session as MaybeArray<{
      session_location?: string | null
      session_start_at?: string | null
      session_end_at?: string | null
    }>,
  )
  return {
    session_location: session?.session_location ?? '',
    session_start_at: session?.session_start_at ?? null,
    session_end_at: session?.session_end_at ?? null,
  }
}

export function getModuleQuizSettings(row: Record<string, unknown>) {
  const quiz = firstRow(
    row.module_quiz_settings as MaybeArray<{
      quiz_passing_pct?: number | null
      quiz_allow_retest?: boolean | null
      quiz_time_limit_minutes?: number | null
      quiz_randomize_questions?: boolean | null
    }>,
  )
  return {
    quiz_passing_pct: quiz?.quiz_passing_pct ?? 60,
    quiz_allow_retest: quiz?.quiz_allow_retest ?? true,
    quiz_time_limit_minutes: quiz?.quiz_time_limit_minutes ?? null,
    quiz_randomize_questions: quiz?.quiz_randomize_questions ?? false,
  }
}
