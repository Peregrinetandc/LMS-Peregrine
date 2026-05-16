import QuizTakeClient from '@/components/QuizTakeClient'
import type { LoadedModule } from '../_lib/load-module-page'

export function QuizRenderer({ data }: { data: LoadedModule }) {
  const {
    title,
    description,
    quizSettings,
    passingPct,
    quizQuestionsStaff,
    quizForLearner,
    quizInitialResult,
    quizTimeLimitResolved,
    randomizeQuiz,
    isCourseStaff,
    isEnrolled,
    moduleId,
  } = data

  return (
    <div className=" space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="lg:text-lg text-base font-bold text-slate-900">{title}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cyan-700">
            MCQ Exam
          </span>
          {!quizSettings.quiz_allow_retest && (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-800">
              Retest disabled
            </span>
          )}
        </div>
      </div>
      {isCourseStaff && (
        <p className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
          Instructor preview. Edit questions in <strong>Course builder</strong>. Passing bar:{' '}
          {passingPct}% correct.
        </p>
      )}
      {isCourseStaff ? (
        <div className="space-y-4">
          {quizQuestionsStaff.length === 0 ? (
            <p className="text-sm text-amber-700">No questions in this quiz yet.</p>
          ) : (
            quizQuestionsStaff.map((q, i) => (
              <div key={q.id} className="border border-slate-200 rounded-lg p-4 bg-slate-50/60">
                <p className="font-medium text-slate-900 mb-2">
                  {i + 1}. {q.prompt}
                </p>
                <ul className="text-sm space-y-1">
                  {q.options.map((o) => (
                    <li key={o.id} className={o.is_correct ? 'text-green-700 font-medium' : 'text-slate-600'}>
                      {o.is_correct ? '✓ ' : '· '}
                      {o.label}
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      ) : isEnrolled ? (
        <QuizTakeClient
          moduleId={moduleId}
          questions={quizForLearner}
          initialResult={quizInitialResult}
          allowRetest={quizSettings.quiz_allow_retest}
          introText={description ?? undefined}
          timeLimitMinutes={quizTimeLimitResolved}
          questionsRandomized={randomizeQuiz}
        />
      ) : null}
    </div>
  )
}
