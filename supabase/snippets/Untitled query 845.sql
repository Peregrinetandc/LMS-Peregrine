-- Google Sheet → LMS sync: run history and per-row state (idempotency)

CREATE TABLE public.sheet_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL CHECK (status IN ('running', 'success', 'partial', 'failed')),
  rows_total int NOT NULL DEFAULT 0,
  rows_ok int NOT NULL DEFAULT 0,
  rows_skipped int NOT NULL DEFAULT 0,
  error_summary text,
  details jsonb
);

CREATE TABLE public.sheet_sync_row_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id text NOT NULL,
  sheet_name text NOT NULL,
  row_number int NOT NULL,
  payload_hash text NOT NULL,
  last_outcome text NOT NULL CHECK (last_outcome IN ('synced', 'partial', 'error', 'skipped')),
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_run_id uuid REFERENCES public.sheet_sync_runs (id) ON DELETE SET NULL,
  UNIQUE (source_id, sheet_name, row_number)
);

CREATE INDEX sheet_sync_runs_started_at_idx ON public.sheet_sync_runs (started_at DESC);
CREATE INDEX sheet_sync_row_state_lookup_idx ON public.sheet_sync_row_state (source_id, sheet_name, row_number);

ALTER TABLE public.sheet_sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sheet_sync_row_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read sheet sync runs"
  ON public.sheet_sync_runs FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins read sheet sync row state"
  ON public.sheet_sync_row_state FOR SELECT TO authenticated
  USING (public.is_admin());

-- No INSERT/UPDATE/DELETE for authenticated — service role bypasses RLS for the sync job
