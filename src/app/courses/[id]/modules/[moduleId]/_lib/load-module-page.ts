/**
 * Server-side loader for the module/lesson page.
 *
 * Encapsulates all auth, access checks, module-row fetch, sub-table embeds,
 * and per-learner status queries into one async call that returns a
 * discriminated union. The page component becomes a thin dispatcher:
 *
 *   - 'unauthorized' / 'no-access' / 'not-found' / 'locked' → branch to redirect / 404 / lock UI
 *   - 'fetch-error' → render the inline "could not load this lesson" view
 *   - 'ok' → render the per-type module UI from `data`
 *
 * Keeps the same query graph and `Promise.all` parallelism as the original page.
 */
import { createClient } from '@/utils/supabase/server'
import { shuffleDeterministic } from '@/lib/shuffle-deterministic'
import { ROLES } from '@/lib/roles'
import { firstEmbeddedAssignment } from '@/lib/embedded-assignment'
import { getModuleContentUrl, getModuleQuizSettings, getModuleSessionFields } from '@/lib/module-subtypes'
import type { QuizQuestionPublic, QuizResult } from '@/components/QuizTakeClient'

export type ModuleType =
  | 'video'
  | 'assignment'
  | 'live_session'
  | 'offline_session'
  | 'mcq'
  | 'feedback'
  | 'external_resource'

export type AssignmentRow = {
  id: string
  description: string | null
  max_score: number | null
  passing_score: number | null
  deadline_at: string | null
  allow_late: boolean | null
}

export type ExternalLink = {
  id: string
  label: string | null
  url: string
  sort_order: number
}

type QuizQuestionStaffView = {
  id: string
  prompt: string
  options: { id: string; label: string; is_correct: boolean; sort_order: number }[]
}

type NextModule = {
  id: string
  title: string
  locked: boolean
  unlockAt: string | null
}

export type LoadedModule = {
  courseId: string
  moduleId: string
  userId: string
  isCourseStaff: boolean
  isEnrolled: boolean

  type: ModuleType
  title: string
  description: string | null
  weekIndex: number | null
  availableFrom: string | null

  contentUrl: string | null
  sessionFields: {
    session_location: string | null
    session_start_at: string | null
    session_end_at: string | null
  }
  quizSettings: {
    quiz_passing_pct: number | null
    quiz_allow_retest: boolean
    quiz_time_limit_minutes: number | null
    quiz_randomize_questions: boolean
  }
  passingPct: number
  externalLinks: ExternalLink[]
  /** Full quiz questions with `is_correct` — for instructor preview. */
  quizQuestionsStaff: QuizQuestionStaffView[]
  /** Learner-facing quiz (no correctness flags), possibly deterministically shuffled. */
  quizForLearner: QuizQuestionPublic[]
  randomizeQuiz: boolean
  quizTimeLimitResolved: number | null
  assignmentRow: AssignmentRow | null

  progressCompleted: boolean
  quizInitialResult: QuizResult | null
  feedbackSubmitted: boolean
  sessionAttendanceMarked: boolean
  assignmentGraded: boolean
  nextModule: NextModule | null

  currentModuleComplete: boolean
  showNextButton: boolean
  nextDisabledReason: string
  assignmentEmbedMissing: boolean
  secondaryErrors: string[]
}

export type LoadModulePageResult =
  | { kind: 'unauthorized' }
  | { kind: 'no-access' }
  | { kind: 'not-found' }
  | { kind: 'fetch-error'; error: string; secondaryErrors: string[] }
  | { kind: 'locked'; unlockDate: string; secondaryErrors: string[] }
  | { kind: 'ok'; data: LoadedModule }

function sortNested<T extends { sort_order?: number }>(arr: T[] | null | undefined): T[] {
  return [...(arr ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
}

export async function loadModulePage(courseId: string, moduleId: string): Promise<LoadModulePageResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { kind: 'unauthorized' }

  // Step 1: auth queries in parallel
  const [courseResult, profileResult, enrollmentResult] = await Promise.all([
    supabase.from('courses').select('instructor_id').eq('id', courseId).single(),
    supabase.from('profiles').select('role').eq('id', user.id).maybeSingle(),
    supabase.from('enrollments').select('id').eq('course_id', courseId).eq('learner_id', user.id).maybeSingle(),
  ])

  const isAdmin = profileResult.data?.role === ROLES.ADMIN
  const isCourseInstructor = courseResult.data?.instructor_id === user.id
  const isCourseStaff = isCourseInstructor || isAdmin
  const enrollment = enrollmentResult.data
  const isEnrolled = !!enrollment

  if (!isCourseStaff && !isEnrolled) return { kind: 'no-access' }

  // Step 2: module fetch with nested embeds
  const { data: mod, error: modulesQueryError } = await supabase
    .from('modules')
    .select(
      `
      id, title, type, week_index, description, available_from,
      module_content ( content_url ),
      module_session ( session_location, session_start_at, session_end_at ),
      module_quiz_settings (
        quiz_passing_pct, quiz_allow_retest, quiz_time_limit_minutes, quiz_randomize_questions
      ),
      module_external_links ( id, label, url, sort_order ),
      quiz_questions ( id, prompt, sort_order, quiz_options ( id, label, is_correct, sort_order ) ),
      assignments(id, description, max_score, passing_score, deadline_at, allow_late)
    `,
    )
    .eq('id', moduleId)
    .single()

  if (!mod) {
    if (modulesQueryError?.code === 'PGRST116') return { kind: 'not-found' }
    return {
      kind: 'fetch-error',
      error: modulesQueryError?.message ?? 'No data returned.',
      secondaryErrors: [],
    }
  }

  const secondaryErrors: string[] = []
  const assignmentRow = firstEmbeddedAssignment(mod.assignments) as AssignmentRow | null

  const moduleRecord = mod as Record<string, unknown>
  const contentUrl = getModuleContentUrl(moduleRecord)
  const sessionFields = getModuleSessionFields(moduleRecord)
  const quizSettings = getModuleQuizSettings(moduleRecord)

  const passingPct =
    typeof quizSettings.quiz_passing_pct === 'number'
      ? quizSettings.quiz_passing_pct
      : parseInt(String(quizSettings.quiz_passing_pct ?? 60), 10) || 60

  const rawLinks = mod.module_external_links as ExternalLink[] | null
  const externalLinks = sortNested(rawLinks)

  const rawQuizQ = mod.quiz_questions as
    | {
        id: string
        prompt: string
        sort_order: number
        quiz_options: { id: string; label: string; is_correct: boolean; sort_order: number }[]
      }[]
    | null
  const quizQuestionsStaff: QuizQuestionStaffView[] = sortNested(rawQuizQ).map((q) => ({
    id: q.id,
    prompt: q.prompt,
    options: sortNested(q.quiz_options),
  }))

  let quizForLearner: QuizQuestionPublic[] = quizQuestionsStaff.map((q) => ({
    id: q.id,
    prompt: q.prompt,
    options: q.options.map((o) => ({ id: o.id, label: o.label })),
  }))

  const moduleType = mod.type as ModuleType
  const randomizeQuiz =
    moduleType === 'mcq' && isEnrolled && !!quizSettings.quiz_randomize_questions

  if (randomizeQuiz && quizForLearner.length > 1) {
    quizForLearner = shuffleDeterministic(quizForLearner, `${moduleId}:${user.id}`)
  }

  const rawQuizTlim = quizSettings.quiz_time_limit_minutes
  const quizTimeLimitResolved =
    moduleType === 'mcq' &&
    rawQuizTlim != null &&
    Number.isFinite(Number(rawQuizTlim)) &&
    Math.trunc(Number(rawQuizTlim)) >= 1
      ? Math.min(1440, Math.trunc(Number(rawQuizTlim)))
      : null

  // Step 3: parallel learner-status queries (only when enrolled)
  let quizInitialResult: QuizResult | null = null
  let feedbackSubmitted = false
  let sessionAttendanceMarked = false
  let progressCompleted = false
  let assignmentGraded = false
  let nextModule: NextModule | null = null

  if (isEnrolled) {
    const progressPromise = supabase
      .from('module_progress')
      .select('is_completed')
      .eq('module_id', moduleId)
      .eq('learner_id', user.id)
      .maybeSingle()

    const quizPromise = moduleType === 'mcq'
      ? supabase
          .from('quiz_attempts')
          .select('score, max_score, passed')
          .eq('module_id', moduleId)
          .eq('learner_id', user.id)
          .order('score', { ascending: false })
          .order('submitted_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null })

    const feedbackPromise = moduleType === 'feedback'
      ? supabase
          .from('module_feedback_submissions')
          .select('id')
          .eq('module_id', moduleId)
          .eq('learner_id', user.id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null })

    const assignmentId = assignmentRow?.id
    const submissionPromise = moduleType === 'assignment' && assignmentId
      ? supabase
          .from('submissions')
          .select('graded_at')
          .eq('assignment_id', assignmentId)
          .eq('learner_id', user.id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null })

    const nextModulePromise = !isCourseStaff
      ? supabase
          .from('modules')
          .select('id, title, available_from')
          .eq('course_id', courseId)
          .order('sort_order', { ascending: true })
      : Promise.resolve({ data: null, error: null })

    const [progressRes, quizRes, feedbackRes, submissionRes, nextModRes] = await Promise.all([
      progressPromise,
      quizPromise,
      feedbackPromise,
      submissionPromise,
      nextModulePromise,
    ])

    if (progressRes.error) secondaryErrors.push(`module_progress: ${progressRes.error.message}`)
    progressCompleted = !!progressRes.data?.is_completed

    if (moduleType === 'mcq') {
      if (quizRes.error) secondaryErrors.push(`quiz_attempts: ${quizRes.error.message}`)
      const attempt = quizRes.data as { score?: number; max_score?: number; passed?: boolean } | null
      if (attempt) {
        const maxScore = attempt.max_score ?? 0
        const score = attempt.score ?? 0
        const pct = maxScore > 0 ? Math.round((score * 100) / maxScore) : 0
        quizInitialResult = {
          score,
          maxScore,
          passed: !!attempt.passed,
          percentCorrect: pct,
          passingPct,
        }
      }
    }

    if (moduleType === 'feedback') {
      if (feedbackRes.error) secondaryErrors.push(`module_feedback_submissions: ${feedbackRes.error.message}`)
      feedbackSubmitted = !!feedbackRes.data
    }

    if (moduleType === 'live_session' || moduleType === 'offline_session') {
      sessionAttendanceMarked = progressCompleted
    }

    if (moduleType === 'assignment') {
      if (submissionRes.error) secondaryErrors.push(`submissions: ${submissionRes.error.message}`)
      assignmentGraded = !!(submissionRes.data as { graded_at?: string } | null)?.graded_at
    }

    if (!isCourseStaff) {
      if (nextModRes.error) secondaryErrors.push(`next-module list: ${nextModRes.error.message}`)
      const list = (nextModRes.data ?? []) as { id: string; title: string; available_from: string | null }[]
      const currentIdx = list.findIndex((m) => m.id === moduleId)
      const nowTs = Date.now()
      if (currentIdx >= 0) {
        const candidate = list[currentIdx + 1]
        if (candidate) {
          const locked =
            candidate.available_from != null &&
            new Date(candidate.available_from).getTime() > nowTs
          nextModule = {
            id: candidate.id,
            title: candidate.title,
            locked,
            unlockAt: candidate.available_from ?? null,
          }
        }
      }
    }
  }

  const currentModuleComplete = isEnrolled && (() => {
    if (moduleType === 'mcq') return !!quizInitialResult?.passed
    if (moduleType === 'feedback') return feedbackSubmitted
    if (moduleType === 'assignment') return progressCompleted || assignmentGraded
    return progressCompleted
  })()

  const showNextButton =
    moduleType !== 'assignment' &&
    moduleType !== 'live_session' &&
    moduleType !== 'offline_session'

  const nextDisabledReason = !nextModule
    ? 'No next lesson in this course.'
    : !currentModuleComplete
      ? 'Complete this lesson first to unlock Next.'
      : nextModule.locked
        ? `Next lesson unlocks on ${nextModule.unlockAt ? new Date(nextModule.unlockAt).toLocaleString() : 'a scheduled date'}.`
        : 'Next lesson unavailable.'

  const assignmentEmbedMissing = moduleType === 'assignment' && !assignmentRow

  // Time-lock check (learners only; staff can preview)
  const availableFrom = (mod.available_from as string | null) ?? null
  if (!isCourseStaff && availableFrom && new Date(availableFrom) > new Date()) {
    return {
      kind: 'locked',
      unlockDate: new Date(availableFrom).toLocaleString(),
      secondaryErrors,
    }
  }

  return {
    kind: 'ok',
    data: {
      courseId,
      moduleId,
      userId: user.id,
      isCourseStaff,
      isEnrolled,

      type: moduleType,
      title: mod.title as string,
      description: (mod.description as string | null) ?? null,
      weekIndex: (mod.week_index as number | null) ?? null,
      availableFrom,

      contentUrl,
      sessionFields,
      quizSettings,
      passingPct,
      externalLinks,
      quizQuestionsStaff,
      quizForLearner,
      randomizeQuiz,
      quizTimeLimitResolved,
      assignmentRow,

      progressCompleted,
      quizInitialResult,
      feedbackSubmitted,
      sessionAttendanceMarked,
      assignmentGraded,
      nextModule,

      currentModuleComplete,
      showNextButton,
      nextDisabledReason,
      assignmentEmbedMissing,
      secondaryErrors,
    },
  }
}
