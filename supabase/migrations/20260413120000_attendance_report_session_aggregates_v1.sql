-- Server-side aggregates for attendance report session list (avoids transferring every roster row).
-- Apply with: supabase db push   or   run this SQL in the Supabase SQL editor.

CREATE OR REPLACE FUNCTION public.attendance_report_session_aggregates_v1(
  p_module_ids uuid[],
  p_presence text,
  p_learner_ids uuid[] DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL
)
RETURNS TABLE (
  module_id uuid,
  total bigint,
  present bigint,
  absent bigint,
  submitted_at_max timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    r.module_id,
    COUNT(*)::bigint AS total,
    COUNT(*) FILTER (WHERE r.is_present IS TRUE)::bigint AS present,
    COUNT(*) FILTER (WHERE r.is_present IS NOT TRUE)::bigint AS absent,
    MAX(r.roster_submitted_at) AS submitted_at_max
  FROM module_session_roster r
  WHERE r.module_id = ANY (p_module_ids)
    AND (
      p_presence = 'all'
      OR (p_presence = 'present' AND r.is_present IS TRUE)
      OR (p_presence = 'absent' AND r.is_present IS NOT TRUE)
    )
    AND (
      p_learner_ids IS NULL
      OR r.learner_id = ANY (p_learner_ids)
    )
    AND (p_from IS NULL OR r.roster_submitted_at >= p_from)
    AND (p_to IS NULL OR r.roster_submitted_at <= p_to)
  GROUP BY r.module_id;
$$;

COMMENT ON FUNCTION public.attendance_report_session_aggregates_v1(uuid[], text, uuid[], timestamptz, timestamptz)
  IS 'Per-module attendance counts for attendance report (filters mirror module_session_roster queries).';

GRANT EXECUTE ON FUNCTION public.attendance_report_session_aggregates_v1(uuid[], text, uuid[], timestamptz, timestamptz)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.attendance_report_session_aggregates_v1(uuid[], text, uuid[], timestamptz, timestamptz)
  TO service_role;

CREATE INDEX IF NOT EXISTS idx_module_session_roster_module_id
  ON public.module_session_roster (module_id);
