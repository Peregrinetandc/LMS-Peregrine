'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

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

  const supabase = await createClient()
  const { error } = await supabase.auth.resend({ type: 'signup', email })
  if (error) return { ok: false, error: error.message }

  return { ok: true, error: null }
}
