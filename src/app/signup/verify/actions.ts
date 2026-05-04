'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

export type VerifyState = { error: string | null }

export async function verifyOtp(_prev: VerifyState, formData: FormData): Promise<VerifyState> {
  const email = (formData.get('email') as string)?.trim()
  const token = (formData.get('token') as string)?.trim()
  const redirectTo = (formData.get('redirect') as string) || '/dashboard'

  if (!email) return { error: 'Missing email — restart signup.' }
  if (!token || token.length !== 6) return { error: 'Enter the 6-digit code.' }

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'signup' })
  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  redirect(redirectTo)
}

export type ResendState = { ok: boolean; error: string | null }

export async function resendOtp(_prev: ResendState, formData: FormData): Promise<ResendState> {
  const email = (formData.get('email') as string)?.trim()
  if (!email) return { ok: false, error: 'Missing email.' }

  const admin = createAdminClient()
  if (!admin) return { ok: false, error: 'Server is not configured.' }

  // DEV path: regenerate the OTP via admin and log it. When SMTP is wired,
  // swap to: await supabase.auth.resend({ type: 'signup', email })
  const { data, error } = await admin.auth.admin.generateLink({ type: 'signup', email })
  if (error) return { ok: false, error: error.message }

  console.log(`[signup OTP resend] ${email} → ${data.properties?.email_otp}`)
  return { ok: true, error: null }
}
