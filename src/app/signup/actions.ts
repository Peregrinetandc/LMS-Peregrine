'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

export async function signup(formData: FormData) {
  const supabase = await createClient()

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

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, role: 'learner' },
    },
  })

  if (error) {
    fail(error.message)
  }

  // Explicitly upsert the profile with role 'learner' via admin client.
  // The DB trigger also does this, but we ensure it's set even if the trigger is unavailable.
  if (data.user) {
    const admin = createAdminClient()
    if (admin) {
      await admin.from('profiles').upsert(
        { id: data.user.id, full_name: fullName, email, role: 'learner' },
        { onConflict: 'id' },
      )
    }
  }

  revalidatePath('/', 'layout')
  redirect(redirectTo)
}
