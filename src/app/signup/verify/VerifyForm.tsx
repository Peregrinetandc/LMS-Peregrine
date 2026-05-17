'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { CheckCircle2, Loader2, Timer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ErrorAlert } from '@/components/ui/error-alert'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp'
import {
  resendOtp,
  verifyOtp,
  type ResendState,
  type VerifyState,
} from './actions'

const RESEND_COOLDOWN_SECONDS = 60

function parseRateLimitSeconds(message: string | null): number | null {
  if (!message) return null
  const m = message.match(/(\d+)\s*seconds?/i)
  return m ? Number(m[1]) : null
}

function VerifySubmit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending}
      className="w-full py-4"
    >
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          <span>Verifying...</span>
        </>
      ) : (
        'Verify email'
      )}
    </Button>
  )
}

export default function VerifyForm({
  email,
  redirectTo,
}: {
  email: string
  redirectTo: string
}) {
  const [token, setToken] = useState('')
  const [verifyState, verifyAction] = useActionState<VerifyState, FormData>(
    verifyOtp,
    { error: null },
  )
  const [resendState, resendAction] = useActionState<ResendState, FormData>(
    resendOtp,
    { ok: false, error: null },
  )

  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS)
  const lastResendSignal = useRef(0)

  useEffect(() => {
    const signal = (resendState.ok ? 1 : 0) + (resendState.error ? 2 : 0)
    if (signal === 0 || signal === lastResendSignal.current) return
    lastResendSignal.current = signal

    if (resendState.ok) {
      setCooldown(RESEND_COOLDOWN_SECONDS)
      return
    }
    const wait = parseRateLimitSeconds(resendState.error)
    if (wait) setCooldown(wait)
  }, [resendState])

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  return (
    <div className="flex flex-col gap-4">
      {verifyState.error ? <ErrorAlert>{verifyState.error}</ErrorAlert> : null}

      {resendState.ok && !verifyState.error ? (
        <div
          role="status"
          className="flex flex-inline gap-2 items-center border border-emerald-200 rounded-lg bg-emerald-50 p-2 text-sm font-medium text-emerald-800"
        >
          <CheckCircle2 className="inline h-4 w-4 shrink-0" aria-hidden />
          New code sent. Check your email.
        </div>
      ) : null}

      <form action={verifyAction} className="flex flex-col items-center gap-4">
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="redirect" value={redirectTo} />
        <input type="hidden" name="token" value={token} />

        <InputOTP
          maxLength={6}
          value={token}
          onChange={setToken}
          inputMode="numeric"
          autoFocus
        >
          <InputOTPGroup>
            <InputOTPSlot index={0} />
            <InputOTPSlot index={1} />
            <InputOTPSlot index={2} />
            <InputOTPSlot index={3} />
            <InputOTPSlot index={4} />
            <InputOTPSlot index={5} />
          </InputOTPGroup>
        </InputOTP>

        <VerifySubmit disabled={token.length !== 6} />
      </form>

      <form action={resendAction} className="flex flex-col items-center">
        <input type="hidden" name="email" value={email} />
        <ResendButton cooldown={cooldown} />
        {resendState.error && !parseRateLimitSeconds(resendState.error) ? (
          <p className="mt-2 text-xs text-red-700">{resendState.error}</p>
        ) : null}
      </form>
    </div>
  )
}

function ResendButton({ cooldown }: { cooldown: number }) {
  const { pending } = useFormStatus()
  const disabled = pending || cooldown > 0

  if (cooldown > 0 && !pending) {
    return (
      <div className="flex flex-col items-center gap-1 text-center">
        <div
          role="timer"
          aria-live="polite"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground"
        >
          <Timer className="h-3.5 w-3.5" aria-hidden />
          Resend available in <span className="tabular-nums text-foreground">{cooldown}s</span>
        </div>
        <button type="submit" disabled className="sr-only">
          Resend code
        </button>
      </div>
    )
  }

  return (
    <Button
      type="submit"
      variant="ghost"
      size="sm"
      disabled={disabled}
      className="text-sm"
    >
      {pending ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          Sending...
        </>
      ) : (
        "Didn't get it? Resend code"
      )}
    </Button>
  )
}
