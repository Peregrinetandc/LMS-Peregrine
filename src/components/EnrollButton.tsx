'use client'

import { useRef, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createClient } from '@/utils/supabase/client'
import { Button } from '@/components/ui/button'
import { finalPrice, formatINR } from '@/lib/course-price'

function isAlreadyEnrolledError(error: { code?: string; message?: string }): boolean {
  if (error.code === '23505') return true
  const m = (error.message ?? '').toLowerCase()
  return m.includes('duplicate') || m.includes('unique constraint') || m.includes('already exists')
}

export default function EnrollButton({
  courseId,
  courseTitle = 'Course enrollment',
  price = 0,
  discountPercent = 0,
  isAuthenticated = true,
}: {
  courseId: string
  courseTitle?: string
  price?: number
  discountPercent?: number
  isAuthenticated?: boolean
}) {
  // courseTitle retained for caller compatibility; checkout page derives its own.
  void courseTitle
  const [loading, setLoading] = useState(false)
  const busyRef = useRef(false)
  const queryClient = useQueryClient()
  const router = useRouter()
  const pathname = usePathname()

  const final = finalPrice({ price, discount_percent: discountPercent })
  const paid = final > 0

  const goToLogin = (target: string, notice: 'auth_required' | 'enroll_required') => {
    const redirectTo = encodeURIComponent(target)
    router.push(`/login?redirect=${redirectTo}&notice=${notice}`)
  }

  const enrollFree = async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      goToLogin(pathname, 'enroll_required')
      return
    }
    const { error } = await supabase.from('enrollments').insert({
      course_id: courseId,
      learner_id: user.id,
    })
    if (error && !isAlreadyEnrolledError(error)) {
      toast.error('Could not enroll', { description: error.message })
      return
    }
    await queryClient.invalidateQueries({ queryKey: ['courses', 'catalog'] })
    await router.refresh()
  }

  const handleClick = async () => {
    if (paid) {
      const target = `/checkout/${courseId}`
      if (!isAuthenticated) {
        goToLogin(target, 'auth_required')
        return
      }
      router.push(target)
      return
    }

    if (!isAuthenticated) {
      goToLogin(pathname, 'enroll_required')
      return
    }
    if (busyRef.current) return
    busyRef.current = true
    setLoading(true)
    try {
      await enrollFree()
    } finally {
      busyRef.current = false
      setLoading(false)
    }
  }

  const label = loading
    ? 'Enrolling…'
    : paid
      ? `Buy for ${formatINR(final)}`
      : 'Enroll now'

  return (
    <Button
      type="button"
      onClick={handleClick}
      disabled={loading}
      size="lg"
      className="w-full min-h-11"
    >
      {label}
    </Button>
  )
}
