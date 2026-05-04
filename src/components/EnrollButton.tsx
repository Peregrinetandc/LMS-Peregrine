'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createClient } from '@/utils/supabase/client'
import { Button } from '@/components/ui/button'
import { finalPrice, formatINR } from '@/lib/course-price'

const RAZORPAY_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js'

type RzpResponse = {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
}

type RzpHandler = (response: RzpResponse) => void

type RzpOptions = {
  key: string
  amount: number
  currency: string
  name: string
  description: string
  image?: string
  order_id: string
  handler: RzpHandler
  prefill?: { name?: string; email?: string; contact?: string }
  notes?: Record<string, string>
  theme?: { color?: string }
  modal?: { ondismiss?: () => void; escape?: boolean; backdropclose?: boolean }
}

interface RzpInstance {
  open: () => void
  on: (event: string, cb: (response: { error: { description?: string } }) => void) => void
}

declare global {
  interface Window {
    Razorpay?: new (options: RzpOptions) => RzpInstance
  }
}

function isAlreadyEnrolledError(error: { code?: string; message?: string }): boolean {
  if (error.code === '23505') return true
  const m = (error.message ?? '').toLowerCase()
  return m.includes('duplicate') || m.includes('unique constraint') || m.includes('already exists')
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false)
    if (window.Razorpay) return resolve(true)
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${RAZORPAY_SCRIPT}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve(true))
      existing.addEventListener('error', () => resolve(false))
      return
    }
    const s = document.createElement('script')
    s.src = RAZORPAY_SCRIPT
    s.async = true
    s.onload = () => resolve(true)
    s.onerror = () => resolve(false)
    document.body.appendChild(s)
  })
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
  const [loading, setLoading] = useState(false)
  const busyRef = useRef(false)
  const queryClient = useQueryClient()
  const router = useRouter()
  const pathname = usePathname()

  const final = finalPrice({ price, discount_percent: discountPercent })
  const paid = final > 0

  useEffect(() => {
    if (paid) {
      void loadRazorpayScript()
    }
  }, [paid])

  const goToSignup = () => {
    const redirectTo = encodeURIComponent(pathname)
    router.push(`/signup?redirect=${redirectTo}`)
  }

  const enrollFree = async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      goToSignup()
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

  const enrollPaid = async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      goToSignup()
      return
    }

    const ready = await loadRazorpayScript()
    if (!ready || !window.Razorpay) {
      toast.error('Payment gateway failed to load. Please retry.')
      return
    }

    const orderRes = await fetch('/api/payments/razorpay/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ course_id: courseId }),
    })
    const orderJson = (await orderRes.json().catch(() => null)) as
      | { order_id: string; amount: number; currency: string; key_id: string; error?: string }
      | null

    if (!orderRes.ok || !orderJson?.order_id) {
      toast.error('Could not start payment', {
        description: orderJson?.error ?? 'Please try again.',
      })
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle()

    const rzp = new window.Razorpay({
      key: orderJson.key_id,
      amount: orderJson.amount,
      currency: orderJson.currency,
      name: 'Peregrine T&C',
      description: courseTitle,
      image: 'https://www.peregrinehub.com/favicon.ico',
      order_id: orderJson.order_id,
      handler: async (response) => {
        try {
          const verifyRes = await fetch('/api/payments/razorpay/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              course_id: courseId,
            }),
          })
          const verifyJson = (await verifyRes.json().catch(() => null)) as
            | { ok?: boolean; error?: string }
            | null
          if (!verifyRes.ok || !verifyJson?.ok) {
            toast.error('Payment verification failed', {
              description: verifyJson?.error ?? 'Please contact support.',
            })
            return
          }
          toast.success('Payment confirmed — enrolled!')
          await queryClient.invalidateQueries({ queryKey: ['courses', 'catalog'] })
          await router.refresh()
        } catch (err) {
          toast.error('Verification error', {
            description: err instanceof Error ? err.message : 'Please contact support.',
          })
        } finally {
          busyRef.current = false
          setLoading(false)
        }
      },
      prefill: {
        name: profile?.full_name ?? undefined,
        email: user.email ?? undefined,
        contact: '',
      },
      notes: {
        course_id: courseId,
        user_id: user.id,
      },
      theme: { color: '#0d5e3a' },
      modal: {
        escape: true,
        backdropclose: false,
        ondismiss: () => {
          busyRef.current = false
          setLoading(false)
          toast.message('Payment cancelled')
        },
      },
    })

    rzp.on('payment.failed', (response) => {
      busyRef.current = false
      setLoading(false)
      toast.error('Payment failed', {
        description: response.error?.description ?? 'Please try again.',
      })
    })

    rzp.open()
  }

  const handleClick = async () => {
    if (!isAuthenticated) {
      goToSignup()
      return
    }
    if (busyRef.current) return
    busyRef.current = true
    setLoading(true)
    try {
      if (paid) {
        await enrollPaid()
        // For paid flow, busy state is cleared by handler/dismiss/failure callbacks.
        return
      }
      await enrollFree()
    } finally {
      if (!paid) {
        busyRef.current = false
        setLoading(false)
      }
    }
  }

  const label = loading
    ? paid
      ? 'Opening payment…'
      : 'Enrolling…'
    : paid
      ? `Pay ${formatINR(final)}`
      : 'Enroll now'

  return (
    <Button
      type="button"
      onClick={handleClick}
      disabled={loading}
      size="lg"
      className="w-full min-h-11 sm:w-auto"
    >
      {label}
    </Button>
  )
}
