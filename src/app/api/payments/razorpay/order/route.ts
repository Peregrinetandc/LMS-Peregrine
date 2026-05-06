import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { amountInPaise, finalPrice } from '@/lib/course-price'
import { validateCouponForCourse, type CourseRow } from '@/lib/coupons'

export const runtime = 'nodejs'

type Body = { course_id?: string; coupon_code?: string }

export async function POST(req: Request) {
  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  if (!keyId || !keySecret) {
    return NextResponse.json({ error: 'Razorpay not configured.' }, { status: 500 })
  }

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }
  const courseId = body.course_id?.trim()
  const couponCode = body.coupon_code?.trim() || null
  if (!courseId) {
    return NextResponse.json({ error: 'Missing course_id.' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  }

  const { data: course, error: courseErr } = await supabase
    .from('courses')
    .select('id, title, price, discount_percent')
    .eq('id', courseId)
    .single()
  if (courseErr || !course) {
    return NextResponse.json({ error: 'Course not found.' }, { status: 404 })
  }

  const price = Number((course as { price?: number }).price ?? 0)
  const discount = Number((course as { discount_percent?: number }).discount_percent ?? 0)
  const baseFinal = finalPrice({ price, discount_percent: discount })
  if (baseFinal <= 0) {
    return NextResponse.json({ error: 'Course is free.' }, { status: 400 })
  }
  const originalPaise = amountInPaise({ price, discount_percent: discount })

  let amount = originalPaise
  let discountPaise = 0
  let couponId: string | null = null
  let appliedCouponCode: string | null = null

  const admin = createAdminClient()

  if (couponCode) {
    const result = await validateCouponForCourse({
      supabase: admin ?? supabase,
      code: couponCode,
      course: course as CourseRow,
      userId: user.id,
    })
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    amount = result.finalPaise
    discountPaise = result.discountPaise
    couponId = result.coupon.id
    appliedCouponCode = result.coupon.code
    if (amount <= 0) {
      return NextResponse.json(
        { error: 'Coupon makes course free; cannot start payment.' },
        { status: 400 },
      )
    }
  }

  const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64')
  const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount,
      currency: 'INR',
      notes: {
        course_id: courseId,
        user_id: user.id,
        ...(appliedCouponCode ? { coupon_code: appliedCouponCode } : {}),
      },
    }),
  })

  if (!rzpRes.ok) {
    const text = await rzpRes.text().catch(() => '')
    return NextResponse.json(
      { error: 'Razorpay order create failed.', detail: text },
      { status: 502 },
    )
  }

  const rzpJson = (await rzpRes.json()) as { id?: string; amount?: number; currency?: string }
  if (!rzpJson.id) {
    return NextResponse.json({ error: 'Razorpay returned no order id.' }, { status: 502 })
  }

  if (admin) {
    await admin.from('course_payments').insert({
      user_id: user.id,
      course_id: courseId,
      razorpay_order_id: rzpJson.id,
      amount_paise: amount,
      original_amount_paise: originalPaise,
      discount_paise: discountPaise,
      coupon_id: couponId,
      currency: 'INR',
      status: 'created',
    })
  }

  return NextResponse.json({
    order_id: rzpJson.id,
    amount: rzpJson.amount ?? amount,
    currency: rzpJson.currency ?? 'INR',
    key_id: keyId,
    discount_paise: discountPaise,
    original_paise: originalPaise,
  })
}
