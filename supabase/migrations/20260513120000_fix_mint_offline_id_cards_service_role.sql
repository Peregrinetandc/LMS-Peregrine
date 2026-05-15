-- Fix: mint_offline_id_cards is called via service_role (admin client) from the
-- LMS Admin server action, which already enforces requireAdmin() before calling.
-- The original function used auth.uid() checks which are null under service_role,
-- causing "forbidden" errors. Auth is enforced at the application layer instead.
--
-- Also drops the accidental 3-param overload created by a previous version of this
-- migration, which caused "could not choose best candidate function" errors.

DROP FUNCTION IF EXISTS public.mint_offline_id_cards(int, text, uuid);

CREATE OR REPLACE FUNCTION public.mint_offline_id_cards(
  p_count int,
  p_batch_label text DEFAULT NULL
) RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted int := 0;
  v_remaining int;
  v_code text;
BEGIN
  IF p_count IS NULL OR p_count < 1 OR p_count > 5000 THEN
    RAISE EXCEPTION 'invalid count';
  END IF;

  v_remaining := p_count;
  WHILE v_remaining > 0 LOOP
    v_code := 'ID-' || public._offline_random_segment(3) || '-' || public._offline_random_segment(3);
    BEGIN
      INSERT INTO public.offline_learner_id_cards (public_code, batch_label)
      VALUES (v_code, p_batch_label);
      v_inserted := v_inserted + 1;
      v_remaining := v_remaining - 1;
    EXCEPTION
      WHEN unique_violation THEN
        NULL;
    END;
  END LOOP;

  RETURN v_inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.mint_offline_id_cards(int, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mint_offline_id_cards(int, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mint_offline_id_cards(int, text) TO service_role;
