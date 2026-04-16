'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { BookOpen, ChevronRight, Search, Users } from 'lucide-react'
import { EmptyState } from '@/components/ui/primitives'
import { toRenderableImageUrl } from '@/lib/drive-image'

export type CatalogCourse = {
  id: string
  course_code: string
  title: string
  description: string | null
  thumbnail_url: string | null
  enrollment_type: string
  created_at: string
  profiles: unknown
}

function instructorName(course: CatalogCourse): string {
  const p = course.profiles as { full_name?: string } | null | undefined
  return p?.full_name?.trim() || 'Instructor'
}

function CourseCard({ course }: { course: CatalogCourse }) {
  const open = course.enrollment_type === 'open'

  return (
    <Link
      href={`/courses/${course.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm ring-slate-200/60 transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
    >
      <div className="relative aspect-video w-full bg-gradient-to-br from-slate-100 via-slate-50 to-indigo-100">
        {course.thumbnail_url ? (
          <Image
            src={toRenderableImageUrl(course.thumbnail_url)}
            alt={course.title}
            fill
            className="object-cover transition duration-300 group-hover:scale-[1.02]"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <BookOpen className="h-12 w-12 text-indigo-300 sm:h-14 sm:w-14" aria-hidden />
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/35 to-transparent" />
        <span
          className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-semibold shadow-sm backdrop-blur-sm sm:right-3 sm:top-3 ${
            open ? 'bg-emerald-600/90 text-white' : 'bg-amber-500/95 text-white'
          }`}
        >
          {open ? 'Open' : 'Invite only'}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3.5 sm:p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {course.course_code}
        </p>
        <h2 className="line-clamp-2 min-h-[2.5rem] text-[15px] font-semibold leading-snug text-slate-900 sm:min-h-[2.75rem] sm:text-base sm:leading-snug">
          <span className="group-hover:text-blue-700">{course.title}</span>
        </h2>
        <p className="line-clamp-2 flex-1 text-sm leading-relaxed text-slate-600">
          {course.description?.trim() || 'Explore this course to see lessons and materials.'}
        </p>

        <div className="mt-1 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <span className="flex min-w-0 items-center gap-1.5 text-xs text-slate-500">
            <Users className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
            <span className="truncate">{instructorName(course)}</span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-0.5 text-xs font-semibold text-blue-600">
            View
            <ChevronRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" aria-hidden />
          </span>
        </div>
      </div>
    </Link>
  )
}

export function CourseCatalog({ courses }: { courses: CatalogCourse[] }) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return courses
    return courses.filter((c) => {
      const inst = instructorName(c).toLowerCase()
      return (
        c.title.toLowerCase().includes(q) ||
        c.course_code.toLowerCase().includes(q) ||
        (c.description?.toLowerCase().includes(q) ?? false) ||
        inst.includes(q)
      )
    })
  }, [courses, query])

  const countLabel =
    courses.length === 1 ? '1 course available' : `${courses.length} courses available`

  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white via-slate-50/80 to-indigo-50/60 px-4 py-5 shadow-sm sm:px-6 sm:py-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-1">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              Course catalog
            </h1>
            <p className="text-xs font-medium text-slate-500 sm:text-sm">{countLabel}</p>
          </div>

          <div className="w-full shrink-0 lg:max-w-sm">
            <label htmlFor="course-catalog-search" className="sr-only">
              Search courses
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden
              />
              <input
                id="course-catalog-search"
                type="search"
                inputMode="search"
                autoComplete="off"
                placeholder="Search by title, code, instructor…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="min-h-11 w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 shadow-inner placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
          </div>
        </div>
      </section>

      {filtered.length === 0 ? (
        query.trim() ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <h3 className="text-base font-semibold text-slate-800 sm:text-lg">No matches</h3>
            <p className="mt-1 text-sm text-slate-500">
              Nothing matched &ldquo;{query.trim()}&rdquo;. Try a different keyword or clear the
              search.
            </p>
            <button
              type="button"
              onClick={() => setQuery('')}
              className="mt-4 inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Clear search
            </button>
          </div>
        ) : (
          <EmptyState
            title="No published courses yet"
            description="Check back soon for new learning paths."
          />
        )
      ) : (
        <>
          {query.trim() ? (
            <p className="text-xs text-slate-500 sm:text-sm">
              Showing {filtered.length} of {courses.length}
            </p>
          ) : null}
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 lg:gap-6">
            {filtered.map((course) => (
              <li key={course.id} className="min-w-0">
                <CourseCard course={course} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
