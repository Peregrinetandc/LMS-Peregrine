'use client'

import { useFormStatus } from 'react-dom'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function LoginSubmitButton() {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" disabled={pending} aria-busy={pending} className="w-full py-4">
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          <span>Signing in...</span>
        </>
      ) : (
        'Sign in'
      )}
    </Button>
  )
}