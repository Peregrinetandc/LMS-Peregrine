'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

export async function signup(formData: FormData) {
  const fullName = (formData.get('full_name') as string)?.trim()
  const email = (formData.get('email') as string)?.trim()
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirm_password') as string
  const redirectTo = (formData.get('redirect') as string) || '/dashboard'

  function fail(msg: string): never {
    redirect(`/signup?message=${encodeURIComponent(msg)}&redirect=${encodeURIComponent(redirectTo)}`)
  }

  if (!fullName || !email || !password || !confirmPassword) {
    fail('Please fill in all fields.')
  }

  if (password !== confirmPassword) {
    fail('Passwords do not match.')
  }

  if (password.length < 6) {
    fail('Password must be at least 6 characters.')
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, role: 'learner' } },
  })

  if (error) {
    fail(error.message)
  }

  const admin = createAdminClient()
  if (admin && data.user) {
    await admin.from('profiles').upsert(
      { id: data.user.id, full_name: fullName, email, role: 'learner' },
      { onConflict: 'id' },
    )
  }

  redirect(
    `/signup/verify?email=${encodeURIComponent(email)}&redirect=${encodeURIComponent(redirectTo)}`,
  )
}
