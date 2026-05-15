-- Run this in Supabase Studio > SQL Editor before deploying.
--
-- session_roster_stats_v1: per-session attendance aggregates for the session
-- list UI. Designed for bulk lookup by module id array; returns one row per
-- module that has at least one roster entry (modules with no entries are simply
-- absent from the result — the caller defaults them to zeros).
--
-- Replaces the use of attendance_report_session_aggregates_v1 in the session
-- list, which was designed for the filterable attendance-report view and carries
-- unnecessary filter parameters (p_presence, p_learner_ids, p_from, p_to) that
-- add noise and a tiny planner cost when listing sessions.

CREATE OR REPLACE FUNCTION session_roster_stats_v1(p_module_ids uuid[])
RETURNS TABLE (
  module_id     uuid,
  present_count integer,
  absent_count  integer,
  roster_size   integer,
  submitted     boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    r.module_id,
    COUNT(*) FILTER (WHERE r.is_present = true)::integer          AS present_count,
    COUNT(*) FILTER (WHERE r.is_present = false)::integer         AS absent_count,
    COUNT(*)::integer                                             AS roster_size,
    COALESCE(bool_or(r.roster_submitted_at IS NOT NULL), false)   AS submitted
  FROM module_session_roster r
  WHERE r.module_id = ANY(p_module_ids)
  GROUP BY r.module_id;
$$;
