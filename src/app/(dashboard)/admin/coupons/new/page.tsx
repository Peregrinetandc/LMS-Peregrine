import { requireRolePage } from '@/lib/auth/require-role'
import { AppCard, PageHeader } from '@/components/ui/primitives'
import { CouponForm, type CourseOption, type CouponFormValues } from '../CouponForm'

export default async function NewCouponPage({
  searchParams,
}: {
  searchParams: Promise<{ courseId?: string }>
}) {
  const { courseId } = await searchParams
  const { supabase } = await requireRolePage('admin')

  const { data: courses } = await supabase
    .from('courses')
    .select('id, title')
    .order('title', { ascending: true })

  const initial: Partial<CouponFormValues> | undefined = courseId
    ? { applicable_course_ids: [courseId] }
    : undefined

  return (
    <div className="space-y-6 p-2">
      <PageHeader title="New coupon" description="Create a discount code for course checkout." />
      <AppCard className="p-4 sm:p-6">
        <CouponForm
          courses={(courses ?? []) as CourseOption[]}
          initial={initial as CouponFormValues | undefined}
        />
      </AppCard>
    </div>
  )
}
