'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createCoupon, updateCoupon } from './actions'

// Server actions throw NEXT_REDIRECT internally to perform the navigation;
// it must propagate up unhandled. Don't treat it as a user-facing error.
function isNextRedirect(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const digest = (err as { digest?: unknown }).digest
  return typeof digest === 'string' && digest.startsWith('NEXT_REDIRECT')
}

export type CouponFormValues = {
  id?: string
  code: string
  discount_type: 'percent' | 'flat'
  discount_value: number
  max_uses: number | null
  applicable_course_ids: string[] | null
  expires_at: string | null
  is_active: boolean
  one_per_user: boolean
}

export type CourseOption = { id: string; title: string }

export function CouponForm({
  initial,
  courses,
}: {
  initial?: CouponFormValues
  courses: CourseOption[]
}) {
  const [pending, startTransition] = useTransition()
  const [discountType, setDiscountType] = useState<'percent' | 'flat'>(
    initial?.discount_type ?? 'percent',
  )
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>(
    initial?.applicable_course_ids ?? [],
  )
  const [error, setError] = useState<string | null>(null)

  const toggleCourse = (id: string) => {
    setSelectedCourseIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    selectedCourseIds.forEach((id) => form.append('applicable_course_ids', id))
    setError(null)
    startTransition(async () => {
      try {
        if (initial?.id) {
          await updateCoupon(initial.id, form)
        } else {
          await createCoupon(form)
        }
      } catch (err) {
        if (isNextRedirect(err)) throw err
        const msg = err instanceof Error ? err.message : 'Could not save coupon'
        setError(msg)
        toast.error(msg)
      }
    })
  }

  const expiresInputValue = initial?.expires_at
    ? new Date(initial.expires_at).toISOString().slice(0, 16)
    : ''

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="code" className="mb-1 block text-sm font-medium text-slate-700">
            Code
          </label>
          <Input
            id="code"
            name="code"
            defaultValue={initial?.code ?? ''}
            placeholder="SUMMER2026"
            required
            autoComplete="off"
            className="uppercase"
          />
        </div>
        <div>
          <label htmlFor="discount_type" className="mb-1 block text-sm font-medium text-slate-700">
            Discount type
          </label>
          <select
            id="discount_type"
            name="discount_type"
            value={discountType}
            onChange={(e) => setDiscountType(e.target.value as 'percent' | 'flat')}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
          >
            <option value="percent">Percent off</option>
            <option value="flat">Flat amount (₹)</option>
          </select>
        </div>
        <div>
          <label htmlFor="discount_value" className="mb-1 block text-sm font-medium text-slate-700">
            {discountType === 'percent' ? 'Percent (1–100)' : 'Amount in ₹'}
          </label>
          <Input
            id="discount_value"
            name="discount_value"
            type="number"
            min={1}
            max={discountType === 'percent' ? 100 : undefined}
            step={discountType === 'percent' ? 1 : 0.01}
            defaultValue={initial?.discount_value ?? ''}
            required
          />
        </div>
        <div>
          <label htmlFor="max_uses" className="mb-1 block text-sm font-medium text-slate-700">
            Max uses (blank = unlimited)
          </label>
          <Input
            id="max_uses"
            name="max_uses"
            type="number"
            min={1}
            defaultValue={initial?.max_uses ?? ''}
          />
        </div>
        <div>
          <label htmlFor="expires_at" className="mb-1 block text-sm font-medium text-slate-700">
            Expires at (blank = never)
          </label>
          <Input
            id="expires_at"
            name="expires_at"
            type="datetime-local"
            defaultValue={expiresInputValue}
          />
        </div>
        <div className="flex items-center gap-2 pt-6">
          <input
            id="is_active"
            name="is_active"
            type="checkbox"
            defaultChecked={initial?.is_active ?? true}
            className="size-4"
          />
          <label htmlFor="is_active" className="text-sm font-medium text-slate-700">
            Active
          </label>
        </div>
        <div className="flex items-center gap-2 sm:col-span-2">
          <input
            id="one_per_user"
            name="one_per_user"
            type="checkbox"
            defaultChecked={initial?.one_per_user ?? true}
            className="size-4"
          />
          <label htmlFor="one_per_user" className="text-sm font-medium text-slate-700">
            Limit to one redemption per user
            <span className="ml-1 font-normal text-slate-500">
              (each buyer can use this code only once across all courses)
            </span>
          </label>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Applicable courses (none selected = all courses)
        </label>
        <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
          {courses.length === 0 ? (
            <p className="px-1 py-2 text-sm text-slate-500">No courses found.</p>
          ) : (
            courses.map((c) => (
              <label
                key={c.id}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={selectedCourseIds.includes(c.id)}
                  onChange={() => toggleCourse(c.id)}
                  className="size-4"
                />
                <span className="truncate">{c.title}</span>
              </label>
            ))
          )}
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : initial?.id ? 'Save changes' : 'Create coupon'}
        </Button>
      </div>
    </form>
  )
}
