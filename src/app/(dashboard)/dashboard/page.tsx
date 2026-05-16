import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { ROLES, isInstructorRole } from '@/lib/roles'
import { ErrorAlert } from '@/components/ui/error-alert'
import type { InstructorSummary, LearnerSummary } from './_types'
import CoordinatorDashboard from './_components/CoordinatorDashboard'
import InstructorDashboard from './_components/InstructorDashboard'
import LearnerDashboard from './_components/LearnerDashboard'

export default async function DashboardPage() {
  const supabase = await createClient()

  // Step 1: Get the current user
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Step 2: Get the user's profile (role + name)
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single()

  const role = profile?.role ?? ROLES.LEARNER
  const name = profile?.full_name ?? user.email?.split('@')[0] ?? 'there'
  const isAdmin = role === ROLES.ADMIN
  const isInstructor = isInstructorRole(role)

  // ── Coordinator: simple static page ──────────────────────
  if (role === ROLES.COORDINATOR) {
    return <CoordinatorDashboard name={name} />
  }

  // ── Instructor / Admin: single RPC call ──────────────────
  if (isInstructor) {
    const { data: rpcData, error } = await supabase.rpc('dashboard_instructor_summary_v1')

    if (error) {
      console.error('[DashboardPage] instructor RPC error:', error.message)
      return (
        <div className="p-4">
          <ErrorAlert title="Failed to load dashboard">Please refresh the page.</ErrorAlert>
        </div>
      )
    }

    const summary = rpcData as InstructorSummary
    return <InstructorDashboard name={name} isAdmin={isAdmin} courses={summary.courses ?? []} />
  }

  // ── Learner: single RPC call ─────────────────────────────
  const { data: rpcData, error } = await supabase.rpc('dashboard_learner_summary_v1')

  if (error) {
    console.error('[DashboardPage] learner RPC error:', error.message)
    return <div className="p-4 text-red-600">Failed to load dashboard. Please refresh.</div>
  }

  const summary = rpcData as LearnerSummary
  return <LearnerDashboard name={name} summary={summary} />
}
