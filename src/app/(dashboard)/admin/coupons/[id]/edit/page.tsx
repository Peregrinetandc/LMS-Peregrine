import { notFound } from 'next/navigation'
import { createAdminClient } from '@/utils/supabase/admin'
import { requireRolePage } from '@/lib/auth/require-role'
import { AppCard, PageHeader } from '@/components/ui/primitives'
import { CouponForm, type CourseOption, type CouponFormValues } from '../../CouponForm'

export default async function EditCouponPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { supabase } = await requireRolePage('admin')

  const admin = createAdminClient()
  const { data: coupon } = admin
    ? await admin.from('coupons').select('*').eq('id', id).maybeSingle()
    : { data: null }
  if (!coupon) notFound()

  const { data: courses } = await supabase
    .from('courses')
    .select('id, title')
    .order('title', { ascending: true })

  const initial: CouponFormValues = {
    id: (coupon as { id: string }).id,
    code: (coupon as { code: string }).code,
    discount_type: (coupon as { discount_type: 'percent' | 'flat' }).discount_type,
    discount_value: Number((coupon as { discount_value: number }).discount_value),
    max_uses: (coupon as { max_uses: number | null }).max_uses,
    applicable_course_ids: (coupon as { applicable_course_ids: string[] | null })
      .applicable_course_ids,
    expires_at: (coupon as { expires_at: string | null }).expires_at,
    is_active: (coupon as { is_active: boolean }).is_active,
    one_per_user: Boolean((coupon as { one_per_user?: boolean }).one_per_user ?? true),
  }

  return (
    <div className="space-y-6 p-2">
      <PageHeader title={`Edit coupon — ${initial.code}`} />
      <AppCard className="p-4 sm:p-6">
        <CouponForm initial={initial} courses={(courses ?? []) as CourseOption[]} />
      </AppCard>
    </div>
  )
}
