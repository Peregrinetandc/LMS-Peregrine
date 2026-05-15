-- Per-course enrollment counts via server-side aggregation.
-- Replaces the pattern of fetching all enrollments rows client-side and
-- counting them in a Map, which silently truncates at PostgREST max_rows.

CREATE OR REPLACE FUNCTION public.enrollment_counts_by_course_v1(
  p_course_ids uuid[]
)
RETURNS TABLE (
  course_id      uuid,
  enrolled_count bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    e.course_id,
    COUNT(*)::bigint AS enrolled_count
  FROM enrollments e
  WHERE e.course_id = ANY(p_course_ids)
  GROUP BY e.course_id;
$$;

COMMENT ON FUNCTION public.enrollment_counts_by_course_v1(uuid[])
  IS 'Returns enrolled learner count per course. Safe for any scale — aggregates server-side.';

GRANT EXECUTE ON FUNCTION public.enrollment_counts_by_course_v1(uuid[])
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.enrollment_counts_by_course_v1(uuid[])
  TO service_role;

CREATE INDEX IF NOT EXISTS idx_enrollments_course_id
  ON public.enrollments (course_id);
