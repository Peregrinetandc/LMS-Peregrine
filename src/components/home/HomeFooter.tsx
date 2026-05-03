import Link from 'next/link'
import Image from 'next/image'

export function HomeFooter() {
  return (
    <footer className="bg-slate-900 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2.5">
            <Image
              src="/logo.png"
              alt="Peregrine T&C"
              width={32}
              height={32}
              className="shrink-0 rounded-full"
            />
            <span className="text-sm font-semibold text-slate-300">Peregrine T&C</span>
          </div>

          <nav className="flex items-center gap-5">
            <Link href="/courses" className="text-sm text-slate-400 transition hover:text-slate-200">
              Courses
            </Link>
            <Link href="/login" className="text-sm text-slate-400 transition hover:text-slate-200">
              Sign in
            </Link>
            <Link href="/signup" className="text-sm text-slate-400 transition hover:text-slate-200">
              Create Account
            </Link>
          </nav>
        </div>

        <div className="mt-6 border-t border-slate-800 pt-4 text-center">
          <p className="text-xs text-slate-500">
            &copy; {new Date().getFullYear()} Peregrine T&C. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
