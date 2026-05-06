'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { ROLES } from '@/lib/roles'
import { normalizeCode } from '@/lib/coupons'

async function ensureAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== ROLES.ADMIN) throw new Error('Unauthorized')
}

type CouponInput = {
  code: string
  discount_type: 'percent' | 'flat'
  discount_value: number
  max_uses: number | null
  applicable_course_ids: string[] | null
  expires_at: string | null
  is_active: boolean
  one_per_user: boolean
}

function parseFormData(form: FormData): CouponInput {
  const code = normalizeCode(String(form.get('code') ?? ''))
  const discount_type = String(form.get('discount_type') ?? 'percent') as 'percent' | 'flat'
  const discount_value = Number(form.get('discount_value') ?? 0)
  const maxUsesRaw = String(form.get('max_uses') ?? '').trim()
  const max_uses = maxUsesRaw === '' ? null : Number(maxUsesRaw)
  const expiresRaw = String(form.get('expires_at') ?? '').trim()
  const expires_at = expiresRaw === '' ? null : new Date(expiresRaw).toISOString()
  const courseIdsRaw = form.getAll('applicable_course_ids').map((v) => String(v)).filter(Boolean)
  const applicable_course_ids = courseIdsRaw.length === 0 ? null : courseIdsRaw
  const is_active = form.get('is_active') === 'on' || form.get('is_active') === 'true'
  const one_per_user =
    form.get('one_per_user') === 'on' || form.get('one_per_user') === 'true'

  if (!code) throw new Error('Code is required')
  if (!['percent', 'flat'].includes(discount_type)) throw new Error('Invalid discount type')
  if (!Number.isFinite(discount_value) || discount_value <= 0) throw new Error('Invalid discount value')
  if (discount_type === 'percent' && discount_value > 100) throw new Error('Percent must be 1–100')

  return {
    code,
    discount_type,
    discount_value,
    max_uses,
    applicable_course_ids,
    expires_at,
    is_active,
    one_per_user,
  }
}

export async function createCoupon(form: FormData) {
  await ensureAdmin()
  const admin = createAdminClient()
  if (!admin) throw new Error('Admin client unavailable')
  const input = parseFormData(form)
  const { error } = await admin.from('coupons').insert(input)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/coupons')
  redirect('/admin/coupons')
}

export async function updateCoupon(id: string, form: FormData) {
  await ensureAdmin()
  const admin = createAdminClient()
  if (!admin) throw new Error('Admin client unavailable')
  const input = parseFormData(form)
  const { error } = await admin
    .from('coupons')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/coupons')
  redirect('/admin/coupons')
}

export async function deleteCoupon(id: string) {
  await ensureAdmin()
  const admin = createAdminClient()
  if (!admin) throw new Error('Admin client unavailable')
  const { error } = await admin.from('coupons').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/coupons')
}

export async function toggleCoupon(id: string, isActive: boolean) {
  await ensureAdmin()
  const admin = createAdminClient()
  if (!admin) throw new Error('Admin client unavailable')
  const { error } = await admin
    .from('coupons')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/coupons')
}
