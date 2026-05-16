import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * Service-role client (bypasses RLS). Use only on the server after verifying the user
 * (e.g. API routes). Never expose SUPABASE_SERVICE_ROLE_KEY to the browser.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/**
 * Route-handler gate: returns the admin client, or a ready-to-return 500 if
 * SUPABASE_SERVICE_ROLE_KEY is missing. Replaces the `admin ?? supabase`
 * fallback pattern, which silently downgrades to user-RLS and can mask
 * real misconfiguration (e.g. payment inserts skipped on missing env var).
 */
export function requireAdminApi():
  | { ok: true; admin: SupabaseClient }
  | { ok: false; response: NextResponse } {
  const admin = createAdminClient()
  if (!admin) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Server misconfigured: admin client unavailable.' },
        { status: 500 },
      ),
    }
  }
  return { ok: true, admin }
}

/**
 * Server-action variant: returns the admin client, or a discriminated error
 * string the caller can fold into its own result shape.
 */
export function requireAdminAction():
  | { ok: true; admin: SupabaseClient }
  | { ok: false; error: string } {
  const admin = createAdminClient()
  if (!admin) {
    return { ok: false, error: 'Server misconfigured: admin client unavailable.' }
  }
  return { ok: true, admin }
}
