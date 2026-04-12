import type { createClient } from '@/utils/supabase/client'

export type ExternalLinkRow = { label: string; url: string }

export type QuizOptRow = { label: string; is_correct: boolean }

export type QuizQuestionRow = { prompt: string; options: QuizOptRow[] }

type Supabase = ReturnType<typeof createClient>

/**
 * Replaces module_external_links and quiz graph for multiple modules after they are saved.
 */
export async function syncQuizAndExternalForModules(
  supabase: Supabase,
  moduleData: Array<{
    moduleId: string
    moduleType: string
    externalLinks: ExternalLinkRow[]
    quizQuestions: QuizQuestionRow[]
  }>
) {
  if (moduleData.length === 0) return

  const moduleIds = moduleData.map(m => m.moduleId)

  // 1. Delete all existing data for these modules
  await Promise.all([
    supabase.from('module_external_links').delete().in('module_id', moduleIds),
    supabase.from('quiz_questions').delete().in('module_id', moduleIds)
  ])

  const allExternalRows: any[] = []
  const allQRows: any[] = []
  const qMap = new Map<string, QuizQuestionRow[]>()

  for (const m of moduleData) {
    if (m.moduleType === 'external_resource') {
      m.externalLinks.forEach((l, i) => {
        const url = l.url.trim()
        if (url) {
          allExternalRows.push({
            module_id: m.moduleId,
            label: l.label.trim() || null,
            url,
            sort_order: i,
          })
        }
      })
    }

    if (m.moduleType === 'mcq' && m.quizQuestions.length > 0) {
      m.quizQuestions.forEach((q, i) => {
        const prompt = q.prompt.trim()
        if (prompt) {
          allQRows.push({
            module_id: m.moduleId,
            prompt,
            sort_order: i,
          })
        }
      })
      qMap.set(m.moduleId, m.quizQuestions)
    }
  }

  // 2. Bulk insert external links
  if (allExternalRows.length > 0) {
    const { error: exErr } = await supabase.from('module_external_links').insert(allExternalRows)
    if (exErr) throw exErr
  }

  // 3. Bulk insert quiz questions and then options
  if (allQRows.length > 0) {
    const { data: insertedQs, error: qErr } = await supabase
      .from('quiz_questions')
      .insert(allQRows)
      .select('id, module_id, prompt')

    if (qErr || !insertedQs) throw qErr ?? new Error('Failed to insert quiz questions')

    const allORows: any[] = []
    for (const qRow of insertedQs) {
      const originalQs = qMap.get(qRow.module_id)
      const originalQ = originalQs?.find(oq => oq.prompt.trim() === qRow.prompt)
      if (!originalQ) continue

      originalQ.options.filter(o => o.label.trim()).forEach((o, i) => {
        allORows.push({
          question_id: qRow.id,
          label: o.label.trim(),
          is_correct: !!o.is_correct,
          sort_order: i,
        })
      })
    }

    if (allORows.length > 0) {
      const { error: oErr } = await supabase.from('quiz_options').insert(allORows)
      if (oErr) throw oErr
    }
  }
}
