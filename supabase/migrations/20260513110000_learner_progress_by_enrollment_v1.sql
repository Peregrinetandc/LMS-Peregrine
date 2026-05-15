-- Type-aware per-enrollment progress via server-side aggregation.
-- Replaces 6+ parallel subqueries that each fetched up to 10 000 rows
-- and counted in JavaScript — silently wrong at scale.
--
-- Completion rules match course_enrollments_progress_v1 and learner_module_status_v1:
--   mcq        → at least one quiz_attempts.passed = true
--   feedback   → row in module_feedback_submissions
--   assignment → module_progress.is_completed  OR  graded submission
--   else       → module_progress.is_completed

CREATE OR REPLACE FUNCTION public.learner_progress_by_enrollment_v1(
  p_enrollment_ids uuid[]
)
RETURNS TABLE (
  enrollment_id     uuid,
  learner_id        uuid,
  course_id         uuid,
  total_modules     bigint,
  completed_modules bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH
  target AS (
    SELECT id AS enrollment_id, learner_id, course_id
    FROM enrollments
    WHERE id = ANY(p_enrollment_ids)
  ),
  course_modules AS (
    SELECT m.id AS module_id, m.course_id, m.type
    FROM modules m
    WHERE m.course_id IN (SELECT DISTINCT course_id FROM target)
  ),
  module_totals AS (
    SELECT course_id, COUNT(*)::bigint AS total
    FROM course_modules
    GROUP BY course_id
  ),
  completions AS (
    -- Standard modules (video, document, external_resource, live_session, offline_session)
    SELECT mp.learner_id, cm.module_id, cm.course_id
    FROM module_progress mp
    JOIN course_modules cm ON cm.module_id = mp.module_id
    WHERE mp.is_completed = true
      AND cm.type NOT IN ('mcq', 'feedback', 'assignment')
      AND mp.learner_id IN (SELECT learner_id FROM target)
    UNION
    -- Assignment completed via module_progress
    SELECT mp.learner_id, cm.module_id, cm.course_id
    FROM module_progress mp
    JOIN course_modules cm ON cm.module_id = mp.module_id AND cm.type = 'assignment'
    WHERE mp.is_completed = true
      AND mp.learner_id IN (SELECT learner_id FROM target)
    UNION
    -- Assignment completed via graded submission
    SELECT sub.learner_id, cm.module_id, cm.course_id
    FROM submissions sub
    JOIN assignments a ON a.id = sub.assignment_id
    JOIN course_modules cm ON cm.module_id = a.module_id AND cm.type = 'assignment'
    WHERE sub.graded_at IS NOT NULL
      AND sub.learner_id IN (SELECT learner_id FROM target)
    UNION
    -- MCQ: at least one passed attempt
    SELECT qa.learner_id, cm.module_id, cm.course_id
    FROM quiz_attempts qa
    JOIN course_modules cm ON cm.module_id = qa.module_id AND cm.type = 'mcq'
    WHERE qa.passed = true
      AND qa.learner_id IN (SELECT learner_id FROM target)
    UNION
    -- Feedback: any submission counts as complete
    SELECT fs.learner_id, cm.module_id, cm.course_id
    FROM module_feedback_submissions fs
    JOIN course_modules cm ON cm.module_id = fs.module_id AND cm.type = 'feedback'
    WHERE fs.learner_id IN (SELECT learner_id FROM target)
  ),
  completed_counts AS (
    SELECT learner_id, course_id, COUNT(DISTINCT module_id)::bigint AS completed
    FROM completions
    GROUP BY learner_id, course_id
  ),
  full_completions AS (
    -- course_completions override: treat learner as 100% done
    SELECT cc.learner_id, cc.course_id
    FROM course_completions cc
    WHERE cc.learner_id IN (SELECT learner_id FROM target)
      AND cc.course_id IN (SELECT DISTINCT course_id FROM target)
  )
  SELECT
    t.enrollment_id,
    t.learner_id,
    t.course_id,
    COALESCE(mt.total, 0)                                       AS total_modules,
    CASE
      WHEN fc.learner_id IS NOT NULL THEN COALESCE(mt.total, 0)
      ELSE COALESCE(cmp.completed, 0)
    END                                                          AS completed_modules
  FROM target t
  LEFT JOIN module_totals     mt  ON mt.course_id  = t.course_id
  LEFT JOIN completed_counts  cmp ON cmp.learner_id = t.learner_id
                                  AND cmp.course_id  = t.course_id
  LEFT JOIN full_completions  fc  ON fc.learner_id  = t.learner_id
                                  AND fc.course_id   = t.course_id;
$$;

COMMENT ON FUNCTION public.learner_progress_by_enrollment_v1(uuid[])
  IS 'Returns type-aware completed/total module counts per enrollment. '
     'Safe for any scale — all aggregation is server-side. '
     'Mirrors the completion logic in course_enrollments_progress_v1.';

GRANT EXECUTE ON FUNCTION public.learner_progress_by_enrollment_v1(uuid[])
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.learner_progress_by_enrollment_v1(uuid[])
  TO service_role;

-- Supporting indexes (no-ops if they already exist)
CREATE INDEX IF NOT EXISTS idx_module_progress_learner_module
  ON public.module_progress (learner_id, module_id) WHERE is_completed = true;

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_learner_module_passed
  ON public.quiz_attempts (learner_id, module_id) WHERE passed = true;

CREATE INDEX IF NOT EXISTS idx_feedback_submissions_learner_module
  ON public.module_feedback_submissions (learner_id, module_id);

CREATE INDEX IF NOT EXISTS idx_submissions_learner_assignment_graded
  ON public.submissions (learner_id, assignment_id) WHERE graded_at IS NOT NULL;
