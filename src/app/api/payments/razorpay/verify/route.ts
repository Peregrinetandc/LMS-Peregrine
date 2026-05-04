import { NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

export const runtime = 'nodejs'

type Body = {
  razorpay_order_id?: string
  razorpay_payment_id?: string
  razorpay_signature?: string
  course_id?: string
}

function isAlreadyEnrolled(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  if (error.code === '23505') return true
  const m = (error.message ?? '').toLowerCase()
  return m.includes('duplicate') || m.includes('unique constraint') || m.includes('already exists')
}

async function ensureProfile(
  user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> | null },
): Promise<void> {
  const admin = createAdminClient()
  if (!admin) return
  const fullName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    null
  await admin
    .from('profiles')
    .upsert(
      { id: user.id, email: user.email ?? null, full_name: fullName },
      { onConflict: 'id', ignoreDuplicates: true },
    )
}

export async function POST(req: Request) {
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  if (!keySecret) {
    return NextResponse.json({ error: 'Razorpay not configured.' }, { status: 500 })
  }

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }
  const orderId = body.razorpay_order_id?.trim()
  const paymentId = body.razorpay_payment_id?.trim()
  const signature = body.razorpay_signature?.trim()
  const courseId = body.course_id?.trim()
  if (!orderId || !paymentId || !signature || !courseId) {
    return NextResponse.json({ error: 'Missing fields.' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  }

  await ensureProfile(user)

  const expected = crypto
    .createHmac('sha256', keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex')

  let signatureMatches = false
  try {
    signatureMatches = crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(signature, 'hex'),
    )
  } catch {
    signatureMatches = false
  }

  if (!signatureMatches) {
    const admin = createAdminClient()
    if (admin) {
      await admin
        .from('course_payments')
        .update({ status: 'failed', razorpay_payment_id: paymentId, razorpay_signature: signature })
        .eq('razorpay_order_id', orderId)
    }
    return NextResponse.json({ error: 'Invalid payment signature.' }, { status: 400 })
  }

  const admin = createAdminClient()
  if (admin) {
    await admin
      .from('course_payments')
      .update({
        status: 'paid',
        razorpay_payment_id: paymentId,
        razorpay_signature: signature,
        updated_at: new Date().toISOString(),
      })
      .eq('razorpay_order_id', orderId)
      .eq('user_id', user.id)
  }

  const { error: enrollErr } = await supabase.from('enrollments').insert({
    course_id: courseId,
    learner_id: user.id,
  })
  if (enrollErr && !isAlreadyEnrolled(enrollErr)) {
    return NextResponse.json(
      { error: 'Payment verified but enrollment failed.', detail: enrollErr.message },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true })
}
