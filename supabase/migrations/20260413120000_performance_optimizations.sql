-- Migration: Performance Optimizations
-- Created at: 2026-04-13 12:00:00

-- Function for atomic ID card scan attendance
CREATE OR REPLACE FUNCTION record_id_card_attendance_scan_v1(
  p_course_id UUID,
  p_module_id UUID,
  p_public_code TEXT,
  p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_learner_id UUID;
  v_full_name TEXT;
  v_email TEXT;
  v_was_already_present BOOLEAN;
  v_roster_id UUID;
BEGIN
  -- 1. Validate session existence and type
  IF NOT EXISTS (
    SELECT 1 FROM modules 
    WHERE id = p_module_id AND course_id = p_course_id AND type = 'offline_session'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_SESSION', 'message', 'Session not found for this course or not an offline session.');
  END IF;

  -- 2. Resolve learner ID from card public code
  SELECT learner_id INTO v_learner_id
  FROM offline_learner_id_cards
  WHERE public_code = p_public_code;

  IF v_learner_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'CARD_NOT_BOUND', 'message', 'This card is not bound to any learner.');
  END IF;

  -- 3. Verify enrollment
  IF NOT EXISTS (
    SELECT 1 FROM enrollments 
    WHERE course_id = p_course_id AND learner_id = v_learner_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_ENROLLED', 'message', 'Learner is not enrolled in this course.');
  END IF;

  -- 4. Get profile metadata
  SELECT full_name, email INTO v_full_name, v_email
  FROM profiles
  WHERE id = v_learner_id;

  -- 5. Atomic Upsert for attendance marking
  -- Check if already present before upserting
  SELECT is_present INTO v_was_already_present
  FROM module_session_roster
  WHERE module_id = p_module_id AND learner_id = v_learner_id;

  INSERT INTO module_session_roster (
    module_id, 
    learner_id, 
    is_present, 
    last_marked_by, 
    updated_at
  ) VALUES (
    p_module_id, 
    v_learner_id, 
    true, 
    p_user_id, 
    now()
  )
  ON CONFLICT (module_id, learner_id) 
  DO UPDATE SET 
    is_present = true,
    last_marked_by = EXCLUDED.last_marked_by,
    updated_at = EXCLUDED.updated_at
  RETURNING (v_was_already_present IS TRUE) INTO v_was_already_present;

  RETURN jsonb_build_object(
    'ok', true, 
    'learner_id', v_learner_id, 
    'full_name', v_full_name, 
    'email', v_email, 
    'was_already_present', COALESCE(v_was_already_present, false)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function for bulk updating grades and feedback
CREATE OR REPLACE FUNCTION bulk_update_submissions_v1(
  p_updates JSONB -- Array of {submissionId, score, feedback, gradedAt, isPassed}
) RETURNS VOID AS $$
BEGIN
  -- Perform bulk update using join with jsonb array
  UPDATE submissions AS s
  SET 
    score = (u->>'score')::NUMERIC,
    feedback = u->>'feedback',
    is_passed = (u->>'isPassed')::BOOLEAN,
    graded_at = (u->>'gradedAt')::TIMESTAMPTZ
  FROM jsonb_array_elements(p_updates) AS u
  WHERE s.id = (u->>'submissionId')::UUID;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
