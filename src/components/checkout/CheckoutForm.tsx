'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Lock, Tag, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatINR } from '@/lib/course-price'
import { useRazorpayCheckout } from '@/hooks/useRazorpayCheckout'

type AppliedCoupon = {
  code: string
  discount_type: 'percent' | 'flat'
  discount_value: number
  discountPaise: number
  finalPaise: number
}

export function CheckoutForm({
  courseId,
  courseTitle,
  basePaise,
  listPaise,
  youSavePaise,
}: {
  courseId: string
  courseTitle: string
  basePaise: number
  listPaise: number
  youSavePaise: number
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { start, busy } = useRazorpayCheckout()

  const [code, setCode] = useState('')
  const [applying, setApplying] = useState(false)
  const [applied, setApplied] = useState<AppliedCoupon | null>(null)
  const [error, setError] = useState<string | null>(null)

  const finalPaise = applied?.finalPaise ?? basePaise
  const couponDiscountPaise = applied?.discountPaise ?? 0
  const totalSavingsPaise = youSavePaise + couponDiscountPaise

  const apply = async () => {
    const trimmed = code.trim()
    if (!trimmed) {
      setError('Enter a coupon code.')
      return
    }
    setApplying(true)
    setError(null)
    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmed, course_id: courseId }),
      })
      const json = (await res.json().catch(() => null)) as
        | {
            ok?: boolean
            error?: string
            coupon?: { code: string; discount_type: 'percent' | 'flat'; discount_value: number }
            discount_paise?: number
            final_paise?: number
          }
        | null
      if (!res.ok || !json?.ok || !json.coupon) {
        setError(json?.error ?? 'Could not apply coupon.')
        setApplied(null)
        return
      }
      setApplied({
        code: json.coupon.code,
        discount_type: json.coupon.discount_type,
        discount_value: Number(json.coupon.discount_value),
        discountPaise: Number(json.discount_paise ?? 0),
        finalPaise: Number(json.final_paise ?? basePaise),
      })
      toast.success(`Coupon ${json.coupon.code} applied`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not apply coupon.')
    } finally {
      setApplying(false)
    }
  }

  const remove = () => {
    setApplied(null)
    setCode('')
    setError(null)
  }

  const pay = async () => {
    const result = await start({
      courseId,
      courseTitle,
      couponCode: applied?.code ?? null,
    })
    if (result.ok) {
      await queryClient.invalidateQueries({ queryKey: ['courses', 'catalog'] })
      router.push(`/courses/${courseId}`)
      router.refresh()
    }
  }

  return (
    <aside className="lg:sticky lg:top-24 lg:self-start">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-3.5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Order summary
          </h2>
        </div>

        <div className="space-y-5 p-5">
          <div>
            <label
              htmlFor="coupon"
              className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700"
            >
              <Tag className="h-3.5 w-3.5 text-slate-500" />
              Coupon code
            </label>
            {applied ? (
              <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span>
                    <span className="font-mono font-semibold text-emerald-900">
                      {applied.code}
                    </span>
                    <span className="ml-2 text-emerald-700">
                      −{formatINR(applied.discountPaise / 100)}
                    </span>
                  </span>
                </span>
                <button
                  type="button"
                  onClick={remove}
                  aria-label="Remove coupon"
                  className="rounded p-1 text-emerald-700 transition hover:bg-emerald-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  id="coupon"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="ENTER CODE"
                  autoComplete="off"
                  disabled={applying}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      void apply()
                    }
                  }}
                  className="font-mono uppercase tracking-wide"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={apply}
                  disabled={applying || !code.trim()}
                >
                  {applying ? 'Applying…' : 'Apply'}
                </Button>
              </div>
            )}
            {error ? <p className="mt-1.5 text-xs text-red-600">{error}</p> : null}
          </div>

          <div className="space-y-2 border-t border-slate-200 pt-4 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>List price</span>
              <span className={listPaise !== basePaise ? 'line-through text-slate-400' : ''}>
                {formatINR(listPaise / 100)}
              </span>
            </div>
            {youSavePaise > 0 ? (
              <div className="flex justify-between text-emerald-700">
                <span>Course discount</span>
                <span>−{formatINR(youSavePaise / 100)}</span>
              </div>
            ) : null}
            {couponDiscountPaise > 0 ? (
              <div className="flex justify-between text-emerald-700">
                <span>Coupon ({applied?.code})</span>
                <span>−{formatINR(couponDiscountPaise / 100)}</span>
              </div>
            ) : null}
            <div className="mt-2 flex items-baseline justify-between border-t border-slate-200 pt-3">
              <span className="text-base font-semibold text-slate-900">Total</span>
              <span className="text-2xl font-bold tracking-tight text-slate-900">
                {formatINR(finalPaise / 100)}
              </span>
            </div>
            {totalSavingsPaise > 0 ? (
              <p className="text-right text-xs font-medium text-emerald-700">
                You save {formatINR(totalSavingsPaise / 100)}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Button
              type="button"
              size="lg"
              onClick={pay}
              disabled={busy || finalPaise <= 0}
              className="h-12 w-full text-base font-semibold"
            >
              {busy ? (
                'Opening payment…'
              ) : (
                <>
                  <Lock className="mr-1 h-4 w-4" />
                  Pay {formatINR(finalPaise / 100)}
                </>
              )}
            </Button>
            <p className="flex items-center justify-center gap-1 text-center text-xs text-slate-500">
              <Lock className="h-3 w-3" />
              Secure payment via Razorpay
            </p>
          </div>
        </div>
      </div>
    </aside>
  )
}
