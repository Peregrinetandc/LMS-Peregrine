import type { SupabaseClient } from '@supabase/supabase-js'
import { applyCoupon, finalPrice } from '@/lib/course-price'

export type CouponRow = {
  id: string
  code: string
  discount_type: 'percent' | 'flat'
  discount_value: number
  max_uses: number | null
  used_count: number
  applicable_course_ids: string[] | null
  expires_at: string | null
  is_active: boolean
  one_per_user: boolean
}

export type CourseRow = {
  id: string
  price: number | null
  discount_percent: number | null
}

export type CouponValidation =
  | {
      ok: true
      coupon: CouponRow
      originalPaise: number
      discountPaise: number
      finalPaise: number
    }
  | { ok: false; error: string; status: number }

export function normalizeCode(code: string): string {
  return code.trim().toUpperCase()
}

export async function validateCouponForCourse({
  supabase,
  code,
  course,
  userId,
}: {
  supabase: SupabaseClient
  code: string
  course: CourseRow
  userId: string
}): Promise<CouponValidation> {
  const normalized = normalizeCode(code)
  if (!normalized) return { ok: false, error: 'Coupon code required.', status: 400 }

  const { data: coupon } = await supabase
    .from('coupons')
    .select(
      'id, code, discount_type, discount_value, max_uses, used_count, applicable_course_ids, expires_at, is_active, one_per_user',
    )
    .ilike('code', normalized)
    .maybeSingle()

  if (!coupon) return { ok: false, error: 'Invalid coupon code.', status: 404 }
  const c = coupon as CouponRow

  if (!c.is_active) return { ok: false, error: 'This coupon is no longer active.', status: 400 }
  if (c.expires_at && new Date(c.expires_at).getTime() < Date.now()) {
    return { ok: false, error: 'This coupon has expired.', status: 400 }
  }
  if (c.max_uses != null && c.used_count >= c.max_uses) {
    return { ok: false, error: 'This coupon has reached its usage limit.', status: 400 }
  }
  if (
    c.applicable_course_ids &&
    c.applicable_course_ids.length > 0 &&
    !c.applicable_course_ids.includes(course.id)
  ) {
    return { ok: false, error: 'This coupon is not valid for this course.', status: 400 }
  }

  if (c.one_per_user) {
    const { data: anyRedemption } = await supabase
      .from('coupon_redemptions')
      .select('id')
      .eq('coupon_id', c.id)
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle()
    if (anyRedemption) {
      return { ok: false, error: 'You have already used this coupon.', status: 400 }
    }
  } else {
    const { data: existing } = await supabase
      .from('coupon_redemptions')
      .select('id')
      .eq('coupon_id', c.id)
      .eq('user_id', userId)
      .eq('course_id', course.id)
      .maybeSingle()
    if (existing) {
      return { ok: false, error: 'You have already used this coupon for this course.', status: 400 }
    }
  }

  const base = finalPrice({
    price: Number(course.price ?? 0),
    discount_percent: Number(course.discount_percent ?? 0),
  })
  const basePaise = Math.round(base * 100)
  if (basePaise <= 0) return { ok: false, error: 'This course is free.', status: 400 }

  const { finalPaise, discountPaise } = applyCoupon(basePaise, {
    discount_type: c.discount_type,
    discount_value: Number(c.discount_value),
  })

  if (discountPaise <= 0) {
    return { ok: false, error: 'Coupon does not apply to this course price.', status: 400 }
  }

  return { ok: true, coupon: c, originalPaise: basePaise, discountPaise, finalPaise }
}
