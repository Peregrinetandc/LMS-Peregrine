import { NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { createAdminClient } from '@/utils/supabase/admin'

export const runtime = 'nodejs'

type RazorpayWebhookEvent = {
  event?: string
  payload?: {
    payment?: {
      entity?: {
        id?: string
        order_id?: string
      }
    }
  }
}

function isAlreadyEnrolled(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  if (error.code === '23505') return true
  const m = (error.message ?? '').toLowerCase()
  return m.includes('duplicate') || m.includes('unique constraint') || m.includes('already exists')
}

export async function POST(req: Request) {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET
  if (!webhookSecret) {
    return NextResponse.json({ error: 'Webhook not configured.' }, { status: 500 })
  }

  const rawBody = await req.text()
  const signature = req.headers.get('x-razorpay-signature') ?? ''

  const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex')

  let signatureValid = false
  try {
    signatureValid = crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(signature, 'hex'),
    )
  } catch {
    signatureValid = false
  }

  if (!signatureValid) {
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 })
  }

  let event: RazorpayWebhookEvent
  try {
    event = JSON.parse(rawBody) as RazorpayWebhookEvent
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  if (event.event !== 'payment.captured') {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const paymentId = event.payload?.payment?.entity?.id
  const orderId = event.payload?.payment?.entity?.order_id

  if (!paymentId || !orderId) {
    return NextResponse.json({ error: 'Missing payment data.' }, { status: 400 })
  }

  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.json({ error: 'Admin client unavailable.' }, { status: 500 })
  }

  type PaymentRow = {
    id: string
    user_id: string
    course_id: string
    status: string
    coupon_id: string | null
    discount_paise: number | null
  }

  const { data: payment } = await admin
    .from('course_payments')
    .select('id, user_id, course_id, status, coupon_id, discount_paise')
    .eq('razorpay_order_id', orderId)
    .maybeSingle<PaymentRow>()

  if (!payment) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  // Idempotent: client-side verify may have already processed this
  if (payment.status === 'paid') {
    return NextResponse.json({ ok: true, already: true })
  }

  await admin
    .from('course_payments')
    .update({
      status: 'paid',
      razorpay_payment_id: paymentId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', payment.id)

  const { error: enrollErr } = await admin.from('enrollments').insert({
    course_id: payment.course_id,
    learner_id: payment.user_id,
  })

  if (enrollErr && !isAlreadyEnrolled(enrollErr)) {
    console.error('[razorpay-webhook] enrollment failed', enrollErr)
    // Return 500 so Razorpay retries the webhook
    return NextResponse.json(
      { error: 'Enrollment failed.', detail: enrollErr.message },
      { status: 500 },
    )
  }

  if (payment.coupon_id) {
    const { error: redemptionErr } = await admin.from('coupon_redemptions').insert({
      coupon_id: payment.coupon_id,
      user_id: payment.user_id,
      course_id: payment.course_id,
      course_payment_id: payment.id,
      discount_paise: payment.discount_paise ?? 0,
    })
    // Unique constraint (coupon_id, user_id, course_id) prevents double-counting
    if (!redemptionErr) {
      const { data: current } = await admin
        .from('coupons')
        .select('used_count')
        .eq('id', payment.coupon_id)
        .maybeSingle()
      const currentCount = Number((current as { used_count?: number } | null)?.used_count ?? 0)
      await admin
        .from('coupons')
        .update({ used_count: currentCount + 1, updated_at: new Date().toISOString() })
        .eq('id', payment.coupon_id)
    }
  }

  return NextResponse.json({ ok: true })
}
