'use client'

import { useFormStatus } from 'react-dom'
import { Loader2 } from 'lucide-react'
import { AppButton } from '@/components/ui/primitives'

export default function LoginSubmitButton() {
  const { pending } = useFormStatus()

  return (
    <AppButton type="submit" disabled={pending} aria-busy={pending} className="w-full">
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          <span>Signing in...</span>
        </>
      ) : (
        'Sign in'
      )}
    </AppButton>
  )
}
