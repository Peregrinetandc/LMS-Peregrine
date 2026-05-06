'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/utils/supabase/client'

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

export type CheckoutInput = {
  courseId: string
  courseTitle: string
  couponCode?: string | null
}

export type CheckoutResult =
  | { ok: true }
  | { ok: false; reason: 'cancelled' | 'failed' | 'error'; message?: string }

export function useRazorpayCheckout() {
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)

  useEffect(() => {
    void loadRazorpayScript()
  }, [])

  const start = async (input: CheckoutInput): Promise<CheckoutResult> => {
    if (busyRef.current) return { ok: false, reason: 'error', message: 'Already in progress' }
    busyRef.current = true
    setBusy(true)

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      busyRef.current = false
      setBusy(false)
      return { ok: false, reason: 'error', message: 'Not signed in' }
    }

    const ready = await loadRazorpayScript()
    if (!ready || !window.Razorpay) {
      busyRef.current = false
      setBusy(false)
      toast.error('Payment gateway failed to load. Please retry.')
      return { ok: false, reason: 'error', message: 'Razorpay script failed to load' }
    }

    const orderRes = await fetch('/api/payments/razorpay/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        course_id: input.courseId,
        coupon_code: input.couponCode ?? undefined,
      }),
    })
    const orderJson = (await orderRes.json().catch(() => null)) as
      | { order_id: string; amount: number; currency: string; key_id: string; error?: string }
      | null

    if (!orderRes.ok || !orderJson?.order_id) {
      busyRef.current = false
      setBusy(false)
      toast.error('Could not start payment', {
        description: orderJson?.error ?? 'Please try again.',
      })
      return { ok: false, reason: 'error', message: orderJson?.error }
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle()

    return new Promise<CheckoutResult>((resolve) => {
      const RazorpayCtor = window.Razorpay
      if (!RazorpayCtor) {
        busyRef.current = false
        setBusy(false)
        resolve({ ok: false, reason: 'error', message: 'Razorpay unavailable' })
        return
      }
      const rzp = new RazorpayCtor({
        key: orderJson.key_id,
        amount: orderJson.amount,
        currency: orderJson.currency,
        name: 'Peregrine T&C',
        description: input.courseTitle,
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
                course_id: input.courseId,
              }),
            })
            const verifyJson = (await verifyRes.json().catch(() => null)) as
              | { ok?: boolean; error?: string }
              | null
            if (!verifyRes.ok || !verifyJson?.ok) {
              toast.error('Payment verification failed', {
                description: verifyJson?.error ?? 'Please contact support.',
              })
              resolve({ ok: false, reason: 'failed', message: verifyJson?.error })
              return
            }
            toast.success('Payment confirmed — enrolled!')
            resolve({ ok: true })
          } catch (err) {
            toast.error('Verification error', {
              description: err instanceof Error ? err.message : 'Please contact support.',
            })
            resolve({
              ok: false,
              reason: 'error',
              message: err instanceof Error ? err.message : undefined,
            })
          } finally {
            busyRef.current = false
            setBusy(false)
          }
        },
        prefill: {
          name: profile?.full_name ?? undefined,
          email: user.email ?? undefined,
          contact: '',
        },
        notes: {
          course_id: input.courseId,
          user_id: user.id,
          ...(input.couponCode ? { coupon_code: input.couponCode } : {}),
        },
        theme: { color: '#0d5e3a' },
        modal: {
          escape: true,
          backdropclose: false,
          ondismiss: () => {
            busyRef.current = false
            setBusy(false)
            toast.message('Payment cancelled')
            resolve({ ok: false, reason: 'cancelled' })
          },
        },
      })

      rzp.on('payment.failed', (response) => {
        busyRef.current = false
        setBusy(false)
        toast.error('Payment failed', {
          description: response.error?.description ?? 'Please try again.',
        })
        resolve({ ok: false, reason: 'failed', message: response.error?.description })
      })

      rzp.open()
    })
  }

  return { start, busy }
}
