import { AppCard, PageHeader } from '@/components/ui/primitives'
import ImportOfflineCardsClient from './ImportOfflineCardsClient'
import { requireRolePage } from '@/lib/auth/require-role'

export default async function AdminOfflineCardsImportPage() {
  await requireRolePage('admin')

  return (
    <div className="space-y-6 p-2">
      <PageHeader
        title="Import offline ID cards"
        description="Upload a CSV, paste codes, or scan ID cards to add cards to the pool."
      />
      <AppCard className="p-2">
        <ImportOfflineCardsClient />
      </AppCard>
    </div>
  )
}
