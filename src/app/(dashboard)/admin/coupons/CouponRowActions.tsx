'use client'

import Link from 'next/link'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { deleteCoupon, toggleCoupon } from './actions'

function isNextRedirect(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const digest = (err as { digest?: unknown }).digest
  return typeof digest === 'string' && digest.startsWith('NEXT_REDIRECT')
}

export function CouponRowActions({ id, isActive }: { id: string; isActive: boolean }) {
  const [pending, startTransition] = useTransition()

  const onToggle = () => {
    startTransition(async () => {
      try {
        await toggleCoupon(id, !isActive)
      } catch (err) {
        if (isNextRedirect(err)) throw err
        toast.error(err instanceof Error ? err.message : 'Could not update')
      }
    })
  }

  const onDelete = () => {
    if (!confirm('Delete this coupon? This cannot be undone.')) return
    startTransition(async () => {
      try {
        await deleteCoupon(id)
        toast.success('Coupon deleted')
      } catch (err) {
        if (isNextRedirect(err)) throw err
        toast.error(err instanceof Error ? err.message : 'Could not delete')
      }
    })
  }

  return (
    <div className="flex justify-end gap-2">
      <Link href={`/admin/coupons/${id}/edit`}>
        <Button variant="outline" size="sm">
          Edit
        </Button>
      </Link>
      <Button variant="ghost" size="sm" onClick={onToggle} disabled={pending}>
        {isActive ? 'Deactivate' : 'Activate'}
      </Button>
      <Button variant="destructive" size="sm" onClick={onDelete} disabled={pending}>
        Delete
      </Button>
    </div>
  )
}
