import { LoginForm } from "@/components/login-form"

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string | string[]; redirect?: string | string[] }>
}) {
  const sp = await searchParams

  const raw = sp?.message
  const message = raw == null ? null : (() => {
    const s = Array.isArray(raw) ? raw[0] : raw
    if (!s) return null
    try { return decodeURIComponent(s) } catch { return s }
  })()

  const rawRedirect = sp?.redirect
  const redirectTo = (() => {
    const s = Array.isArray(rawRedirect) ? rawRedirect[0] : rawRedirect
    if (!s) return ''
    try { return decodeURIComponent(s) } catch { return s }
  })()

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <LoginForm errorMessage={message} redirectTo={redirectTo} />
      </div>
    </div>
  )
}
