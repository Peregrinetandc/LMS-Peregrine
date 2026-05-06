import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { AppCard, PageHeader } from '@/components/ui/primitives'

export default function CoordinatorDashboard({ name }: { name: string }) {
  return (
    <div className="space-y-4 px-2 py-2">
      <PageHeader title={`Welcome, ${name}!`} description="Coordinator" />
      <AppCard className="p-6 space-y-3">
        <p className="text-slate-700">
          Use the below tools to manage ID card bindings, take attendance via ID card scanning, and
          grade assignments for all courses.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/attendance/bind-cards"
            className="border border-blue-600 rounded-lg px-4 py-2 inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:bg-blue-50"
          >
            <ArrowRight className="w-4 h-4" />
            Go to Bind ID cards
          </Link>
          <Link
            href="/attendance/id-card-scan"
            className="border border-blue-600 rounded-lg px-4 py-2 inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:bg-blue-50"
          >
            <ArrowRight className="w-4 h-4" />
            Scan ID attendance
          </Link>
          <Link
            href="/grading"
            className="border border-blue-600 rounded-lg px-4 py-2 inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:bg-blue-50"
          >
            <ArrowRight className="w-4 h-4" />
            Open grading
          </Link>
        </div>
      </AppCard>
    </div>
  )
}
