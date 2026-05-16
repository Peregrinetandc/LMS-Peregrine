import { AppCard, PageHeader } from '@/components/ui/primitives'
import LearnerIdLookupClient from './LearnerIdLookupClient'
import { requireRolePage } from '@/lib/auth/require-role'

export default async function LearnerIdLookupPage() {
  await requireRolePage('instructor')

  return (
    <div className="space-y-6 p-2">
      <PageHeader
        title="Learner ID lookup"
        description="Scan or enter an offline ID card code to see who it belongs to (if bound)."
      />
      <AppCard className="p-2">
        <LearnerIdLookupClient />
      </AppCard>
    </div>
  )
}
