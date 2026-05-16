import Link from 'next/link'
import { Ticket } from 'lucide-react'
import { createAdminClient } from '@/utils/supabase/admin'
import { requireRolePage } from '@/lib/auth/require-role'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/primitives'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { formatINR } from '@/lib/course-price'
import { CouponRowActions } from './CouponRowActions'

type CouponListRow = {
  id: string
  code: string
  discount_type: 'percent' | 'flat'
  discount_value: number
  max_uses: number | null
  used_count: number
  expires_at: string | null
  is_active: boolean
  one_per_user: boolean
  applicable_course_ids: string[] | null
  created_at: string
}

export default async function AdminCouponsPage({
  searchParams,
}: {
  searchParams: Promise<{ courseId?: string }>
}) {
  const { courseId } = await searchParams
  const { supabase } = await requireRolePage('admin')

  const admin = createAdminClient()
  const { data: coupons } = (admin
    ? await admin.from('coupons').select('*').order('created_at', { ascending: false })
    : { data: [] as CouponListRow[] }) as { data: CouponListRow[] | null }

  const allCoupons = coupons ?? []
  const list = courseId
    ? allCoupons.filter(
        (c) =>
          !c.applicable_course_ids ||
          c.applicable_course_ids.length === 0 ||
          c.applicable_course_ids.includes(courseId),
      )
    : allCoupons

  let courseTitle: string | null = null
  if (courseId) {
    const { data: course } = await supabase
      .from('courses')
      .select('title')
      .eq('id', courseId)
      .maybeSingle()
    courseTitle = (course as { title?: string } | null)?.title ?? null
  }

  return (
    <div className="space-y-6 p-2">
      <PageHeader
        title="Coupons"
        description={
          courseId
            ? `Coupons that apply to ${courseTitle ?? 'this course'} (including all-courses coupons).`
            : 'Manage discount codes that buyers can apply at checkout.'
        }
        action={
          <Link
            href={
              courseId ? `/admin/coupons/new?courseId=${courseId}` : '/admin/coupons/new'
            }
          >
            <Button>New coupon</Button>
          </Link>
        }
      />

      {courseId ? (
        <Link
          href="/admin/coupons"
          className="inline-flex items-center text-sm text-slate-600 hover:text-slate-900"
        >
          ← View all coupons
        </Link>
      ) : null}

      {list.length === 0 ? (
        <Empty className="border border-slate-200 bg-white">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Ticket />
            </EmptyMedia>
            <EmptyTitle>
              {courseId ? 'No coupons for this course' : 'No coupons yet'}
            </EmptyTitle>
            <EmptyDescription>
              {courseId
                ? 'Create a coupon scoped to this course, or one that applies to all courses.'
                : 'Discount codes let buyers save at checkout. Create your first one to get started.'}
            </EmptyDescription>
          </EmptyHeader>
          <Link
            href={courseId ? `/admin/coupons/new?courseId=${courseId}` : '/admin/coupons/new'}
          >
            <Button>Create coupon</Button>
          </Link>
        </Empty>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Discount</th>
              <th className="px-4 py-3">Uses</th>
              <th className="px-4 py-3">Scope</th>
              <th className="px-4 py-3">Expires</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-mono font-semibold text-slate-900">{c.code}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {c.discount_type === 'percent'
                      ? `${c.discount_value}%`
                      : formatINR(Number(c.discount_value))}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {c.used_count}
                    {c.max_uses != null ? ` / ${c.max_uses}` : ''}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {c.applicable_course_ids && c.applicable_course_ids.length > 0
                      ? `${c.applicable_course_ids.length} course(s)`
                      : 'All courses'}
                    {c.one_per_user ? (
                      <span className="ml-2 inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                        1× per user
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {c.expires_at ? new Date(c.expires_at).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        c.is_active
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {c.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <CouponRowActions id={c.id} isActive={c.is_active} />
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      )}
    </div>
  )
}
