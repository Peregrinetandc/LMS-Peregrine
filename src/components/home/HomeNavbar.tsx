import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'

export function HomeNavbar() {
  return (
    <nav className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-16 items-center justify-between gap-3 py-2">
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <Image
              src="/logo.png"
              alt="Peregrine T&C"
              width={45}
              height={45}
              className="shrink-0 rounded-full"
            />
            <span className="text-base font-bold text-slate-900 sm:text-lg">Peregrine T&C</span>
          </Link>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/signup">Create Account</Link>
            </Button>
          </div>
        </div>
      </div>
    </nav>
  )
}
