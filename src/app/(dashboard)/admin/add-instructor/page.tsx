import { PageHeader } from '@/components/ui/primitives'
import AddInstructorForm from './AddInstructorForm'
import { requireRolePage } from '@/lib/auth/require-role'

export default async function AddInstructorPage() {
  await requireRolePage('admin')

  return (
    <div className="space-y-6 p-2">
      <PageHeader
        title="Add instructor"
        description="Creates a instructor account."
      />
      <AddInstructorForm />
    </div>
  )
}
