'use client'

import { useEffect, useId, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'
import { Menu, X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/query-keys'

export default function ModulesDrawerShell({
  children,
  sidebar,
}: {
  children: ReactNode
  sidebar: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const drawerId = useId()
  const quizInProgress = useQuery({
    queryKey: queryKeys.quizInProgress(),
    queryFn: () => false,
    initialData: false,
    enabled: false,
    staleTime: Infinity,
  }).data

  useEffect(() => {
    if (quizInProgress && open) setOpen(false)
  }, [quizInProgress, open])

  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const closeDrawerOnModuleLinkClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null
    const clickedLink = target?.closest('a[href]') as HTMLAnchorElement | null
    if (!clickedLink) return

    const href = clickedLink.getAttribute('href') ?? ''
    if (href.includes('/modules/')) {
      setOpen(false)
    }
  }

  return (
    <div className="relative min-h-[calc(100vh-8rem)]">
      {!quizInProgress && (
        <div className="sticky top-20 z-20 mb-4 w-fit">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-expanded={open}
            aria-controls={drawerId}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <Menu className="h-4 w-4" />
            Syllabus
          </button>
        </div>
      )}

      <div className="w-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 md:p-8">
        {children}
      </div>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close syllabus drawer overlay"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-slate-950/35"
          />

          <aside
            id={drawerId}
            aria-label="Course syllabus navigation"
            className="fixed inset-y-0 left-0 z-50 flex h-[100dvh] w-full max-w-md flex-col border-r border-slate-200 bg-white p-3 shadow-2xl sm:max-w-lg"
          >
            {/* Single scroll region so wheel/touch works over the title bar too, not only below it */}
            <div
              className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain pr-1"
              onClick={closeDrawerOnModuleLinkClick}
            >
              <div className="sticky top-0 z-10 -mx-px mb-3 flex items-center justify-between border-b border-slate-100 bg-white pb-2 pt-0.5">
                <h2 className="text-sm font-semibold text-slate-800">Course Syllabus</h2>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Close syllabus drawer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {sidebar}
            </div>
          </aside>
        </>
      )}
    </div>
  )
}
