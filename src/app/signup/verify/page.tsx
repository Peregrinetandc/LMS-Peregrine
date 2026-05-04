import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import VerifyForm from './VerifyForm'

function maskEmail(email: string) {
  const [local, domain] = email.split('@')
  if (!domain) return email
  const head = local.slice(0, 2)
  const tail = local.length > 2 ? local.slice(-1) : ''
  return `${head}${'*'.repeat(Math.max(1, local.length - head.length - tail.length))}${tail}@${domain}`
}

export default async function VerifySignupPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string | string[]; redirect?: string | string[] }>
}) {
  const sp = await searchParams

  const rawEmail = sp?.email
  const email = (() => {
    const s = Array.isArray(rawEmail) ? rawEmail[0] : rawEmail
    if (!s) return ''
    try { return decodeURIComponent(s) } catch { return s }
  })()

  const rawRedirect = sp?.redirect
  const redirectTo = (() => {
    const s = Array.isArray(rawRedirect) ? rawRedirect[0] : rawRedirect
    if (!s) return '/dashboard'
    try { return decodeURIComponent(s) } catch { return s }
  })() || '/dashboard'

  if (!email) {
    redirect('/signup?message=' + encodeURIComponent('Start signup again to receive a code.'))
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Card>
          <CardHeader className="text-center">
            <div className="flex items-center justify-center rounded-md">
              <Image src="/logo.png" alt="Peregrine LMS Logo" width={45} height={45} />
            </div>
            <CardTitle className="text-xl">Verify your email</CardTitle>
            <CardDescription>
              Enter the 6-digit code sent to <span className="font-medium">{maskEmail(email)}</span>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <VerifyForm email={email} redirectTo={redirectTo} />
            <p className="mt-4 text-center text-sm text-muted-foreground">
              Wrong email?{' '}
              <Link
                href="/signup"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Start over
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
