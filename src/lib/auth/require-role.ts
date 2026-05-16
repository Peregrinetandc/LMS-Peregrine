/**
 * Server-side role gates for pages, server actions, and route handlers.
 *
 * Three context-shaped wrappers around the same auth + role-lookup check.
 * Failure shapes differ by context, so each surface gets its own wrapper:
 *
 *  - `requireRolePage(bucket)`   throws via `redirect()` on failure (server components / pages)
 *  - `requireRoleAction(bucket)` returns a discriminated result (server actions)
 *  - `requireRoleApi(bucket)`    returns either user/role or a ready-to-return NextResponse (route handlers)
 *
 * All three return the same Supabase client they used for the role lookup,
 * so callers don't have to create it twice.
 */
import { redirect } from 'next/navigation'
import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/server'
import { ROLES, isInstructorRole, isStaffRole, type Role } from '@/lib/roles'

export type RoleBucket = 'admin' | 'instructor' | 'staff'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

type CheckOk = {
  ok: true
  user: User
  role: Role
  supabase: SupabaseServerClient
}

type CheckFail = {
  ok: false
  reason: 'unauth' | 'forbidden'
  role: Role | null
  user: User | null
  supabase: SupabaseServerClient
}

export type RoleCheckResult = CheckOk | CheckFail

function matchesBucket(role: string | null | undefined, bucket: RoleBucket): boolean {
  switch (bucket) {
    case 'admin':
      return role === ROLES.ADMIN
    case 'instructor':
      return isInstructorRole(role)
    case 'staff':
      return isStaffRole(role)
  }
}

/** Run the auth + role lookup. Returns a discriminated result; never throws or redirects. */
async function check(bucket: RoleBucket): Promise<RoleCheckResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, reason: 'unauth', role: null, user: null, supabase }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const role = (profile?.role ?? null) as Role | null

  if (!matchesBucket(role, bucket)) {
    return { ok: false, reason: 'forbidden', role, user, supabase }
  }

  return { ok: true, user, role: role as Role, supabase }
}

/**
 * Page / server-component gate. Redirects on failure and never returns the
 * unauthorized path. Callers can use the returned `supabase` client directly.
 */
export async function requireRolePage(bucket: RoleBucket): Promise<{
  user: User
  role: Role
  supabase: SupabaseServerClient
}> {
  const result = await check(bucket)
  if (!result.ok) {
    if (result.reason === 'unauth') redirect('/login')
    redirect('/unauthorized')
  }
  return { user: result.user, role: result.role, supabase: result.supabase }
}

/**
 * Server action gate. Returns a discriminated result; the caller decides
 * the error shape (most actions return `{ error: string }` or similar).
 */
export async function requireRoleAction(bucket: RoleBucket): Promise<RoleCheckResult> {
  return check(bucket)
}

type ApiOk = { ok: true; user: User; role: Role; supabase: SupabaseServerClient }
type ApiFail = { ok: false; response: NextResponse }

/**
 * Route handler gate. On failure, returns a ready-to-return NextResponse
 * (401 for unauth, 403 for forbidden). On success, returns the user/role/client.
 */
export async function requireRoleApi(bucket: RoleBucket): Promise<ApiOk | ApiFail> {
  const result = await check(bucket)
  if (!result.ok) {
    const status = result.reason === 'unauth' ? 401 : 403
    const error = result.reason === 'unauth' ? 'Not signed in' : 'Forbidden'
    return { ok: false, response: NextResponse.json({ error }, { status }) }
  }
  return { ok: true, user: result.user, role: result.role, supabase: result.supabase }
}
