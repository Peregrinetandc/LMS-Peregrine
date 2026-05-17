-- Paginated RPC returning the full list of due assignments for the current
-- learner, plus an uncapped total count. Powers the dedicated
-- /dashboard/due-assignments page (where the inline list on the dashboard only
-- shows the top 3 and we need accurate totals + paging beyond that).
--
-- Shape:
--   { total: int, items: [...], limit: int, offset: int }
--
-- Predicates mirror dashboard_learner_summary_v1's due_assignments subquery.

CREATE OR REPLACE FUNCTION public.learner_due_assignments_v1(
  p_limit int DEFAULT 25,
  p_offset int DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_uid uuid;
  v_limit int;
  v_offset int;
  v_total int;
  v_items jsonb;
BEGIN
  v_uid := (select auth.uid());
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  v_limit := greatest(1, least(coalesce(p_limit, 25), 100));
  v_offset := greatest(0, coalesce(p_offset, 0));

  SELECT count(*)::int INTO v_total
  FROM assignments a
  JOIN modules m ON m.id = a.module_id AND m.type = 'assignment'
  JOIN courses c ON c.id = m.course_id
  JOIN enrollments e ON e.course_id = c.id AND e.learner_id = v_uid
  WHERE a.deadline_at IS NOT NULL
    AND (m.available_from IS NULL OR m.available_from <= now())
    AND NOT EXISTS (
      SELECT 1 FROM submissions s
      WHERE s.assignment_id = a.id
        AND s.learner_id = v_uid
        AND s.is_turned_in = true
    );

  SELECT coalesce(jsonb_agg(row_data ORDER BY deadline_at_ts ASC), '[]'::jsonb)
  INTO v_items
  FROM (
    SELECT
      a.id           AS assignment_id,
      m.id           AS module_id,
      m.title        AS module_title,
      c.id           AS course_id,
      c.title        AS course_title,
      c.course_code  AS course_code,
      a.deadline_at  AS deadline_at_ts
    FROM assignments a
    JOIN modules m ON m.id = a.module_id AND m.type = 'assignment'
    JOIN courses c ON c.id = m.course_id
    JOIN enrollments e ON e.course_id = c.id AND e.learner_id = v_uid
    WHERE a.deadline_at IS NOT NULL
      AND (m.available_from IS NULL OR m.available_from <= now())
      AND NOT EXISTS (
        SELECT 1 FROM submissions s
        WHERE s.assignment_id = a.id
          AND s.learner_id = v_uid
          AND s.is_turned_in = true
      )
    ORDER BY a.deadline_at ASC
    LIMIT v_limit OFFSET v_offset
  ) sub,
  LATERAL (
    SELECT jsonb_build_object(
      'assignment_id', sub.assignment_id,
      'module_id',     sub.module_id,
      'module_title',  sub.module_title,
      'course_id',     sub.course_id,
      'course_title',  sub.course_title,
      'course_code',   sub.course_code,
      'deadline_at',   sub.deadline_at_ts
    ) AS row_data
  ) lat;

  RETURN jsonb_build_object(
    'total',  v_total,
    'items',  v_items,
    'limit',  v_limit,
    'offset', v_offset
  );
END;
$$;

REVOKE ALL ON FUNCTION public.learner_due_assignments_v1(int, int) FROM public;
GRANT EXECUTE ON FUNCTION public.learner_due_assignments_v1(int, int) TO authenticated;
