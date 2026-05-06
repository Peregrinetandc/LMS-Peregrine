import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { validateCouponForCourse, type CourseRow } from '@/lib/coupons'

export const runtime = 'nodejs'

type Body = { code?: string; course_id?: string }

export async function POST(req: Request) {
  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }
  const code = body.code?.trim()
  const courseId = body.course_id?.trim()
  if (!code || !courseId) {
    return NextResponse.json({ error: 'Missing fields.' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  }

  const { data: course } = await supabase
    .from('courses')
    .select('id, price, discount_percent')
    .eq('id', courseId)
    .single()
  if (!course) {
    return NextResponse.json({ error: 'Course not found.' }, { status: 404 })
  }

  const admin = createAdminClient()
  const result = await validateCouponForCourse({
    supabase: admin ?? supabase,
    code,
    course: course as CourseRow,
    userId: user.id,
  })

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status })
  }

  return NextResponse.json({
    ok: true,
    coupon: {
      id: result.coupon.id,
      code: result.coupon.code,
      discount_type: result.coupon.discount_type,
      discount_value: result.coupon.discount_value,
    },
    original_paise: result.originalPaise,
    discount_paise: result.discountPaise,
    final_paise: result.finalPaise,
  })
}
