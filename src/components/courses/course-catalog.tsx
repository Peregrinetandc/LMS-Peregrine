'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { EmptyState } from '@/components/ui/primitives'
import { CATALOG_PAGE_SIZE, type CatalogCourse, type CatalogDepartment } from '@/lib/catalog-courses'
import { queryKeys } from '@/lib/query/query-keys'
import { CourseCard } from '@/components/courses/CourseCard'

export type { CatalogCourse, CatalogDepartment } from '@/lib/catalog-courses'

export function groupCatalogByDepartment(courses: CatalogCourse[]) {
  const map = new Map<
    string,
    { department: CatalogDepartment | null; courses: CatalogCourse[] }
  >()
  for (const c of courses) {
    const d = c.department
    const key = d?.id ?? '_none'
    if (!map.has(key)) {
      map.set(key, { department: d, courses: [] })
    }
    map.get(key)!.courses.push(c)
  }
  const sections = [...map.values()]
  sections.sort((a, b) => {
    const ao = a.department?.sort_order ?? 9999
    const bo = b.department?.sort_order ?? 9999
    if (ao !== bo) return ao - bo
    return (a.department?.name ?? '').localeCompare(b.department?.name ?? '')
  })
  return sections
}


export function CourseCatalog({
  courses: initialCourses,
  departments,
  totalCount: initialTotalCount,
  page: initialPage,
  q: initialQ,
  departmentId: initialDepartmentId,
  fetchError: initialFetchError,
}: {
  courses: CatalogCourse[]
  departments: CatalogDepartment[]
  totalCount: number
  page: number
  q: string
  departmentId: string
  fetchError: string | null
}) {
  const router = useRouter()
  const [draftQ, setDraftQ] = useState(initialQ)
  const [draftDepartmentId, setDraftDepartmentId] = useState(initialDepartmentId)

  const params = useMemo(
    () => ({ q: initialQ.trim(), dept: initialDepartmentId.trim(), page: initialPage }),
    [initialDepartmentId, initialPage, initialQ],
  )
  const catalogQuery = useQuery({
    queryKey: queryKeys.coursesCatalog(params),
    queryFn: async () => {
      const urlParams = new URLSearchParams()
      if (params.q) urlParams.set('q', params.q)
      if (params.dept) urlParams.set('dept', params.dept)
      if (params.page > 1) urlParams.set('page', String(params.page))
      const qs = urlParams.toString()
      const url = qs ? `/api/courses/catalog?${qs}` : '/api/courses/catalog'
      const res = await fetch(url, { cache: 'no-store' })
      const json = (await res.json()) as {
        courses?: CatalogCourse[]
        totalCount?: number
        error?: string
      }
      if (!res.ok) throw new Error(json.error || 'Failed to load course catalog.')
      return {
        courses: json.courses ?? [],
        totalCount: json.totalCount ?? 0,
      }
    },
    initialData: {
      courses: initialCourses,
      totalCount: initialTotalCount,
    },
  })

  const courses = useMemo(() => catalogQuery.data?.courses ?? [], [catalogQuery.data?.courses])
  const totalCount = catalogQuery.data?.totalCount ?? 0
  const page = initialPage
  const fetchError = catalogQuery.error instanceof Error ? catalogQuery.error.message : initialFetchError
  const pending = catalogQuery.isFetching
  const sections = useMemo(() => groupCatalogByDepartment(courses), [courses])
  const from = totalCount === 0 ? 0 : (page - 1) * CATALOG_PAGE_SIZE + 1
  const to = Math.min(page * CATALOG_PAGE_SIZE, totalCount)
  const hasMore = page * CATALOG_PAGE_SIZE < totalCount
  const countLabel =
    totalCount === 1 ? '1 course matches' : `${totalCount} courses match`

  function navigate(nextPage: number, nextQuery: string, nextDept: string) {
    const params = new URLSearchParams()
    if (nextQuery.trim()) params.set('q', nextQuery.trim())
    if (nextDept.trim()) params.set('dept', nextDept.trim())
    if (nextPage > 1) params.set('page', String(nextPage))
    const query = params.toString()
    router.push(query ? `/courses?${query}` : '/courses')
  }

  if (fetchError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50/80 p-6 text-sm text-red-800">
        {fetchError}
      </div>
    )
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white via-slate-50/80 to-indigo-50/60 px-4 py-5 shadow-sm sm:px-6 sm:py-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-1">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              Course catalog
            </h1>
            <p className="text-sm leading-relaxed text-slate-600 sm:text-base">
              Browse by department, search, and open a course. Results load in pages for speed.
            </p>
            <p className="text-xs font-medium text-slate-500 sm:text-sm">{countLabel}</p>
          </div>

          <form
            className="flex w-full flex-col gap-3 sm:flex-row sm:items-end lg:max-w-xl"
            onSubmit={(e) => {
              e.preventDefault()
              navigate(1, draftQ, draftDepartmentId)
            }}
          >
            <div className="min-w-0 flex-1">
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
                  placeholder="Title, code, description…"
                  value={draftQ}
                  onChange={(e) => setDraftQ(e.target.value)}
                  className="min-h-11 w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 shadow-inner placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
            </div>
            <div className="w-full sm:w-44">
              <label htmlFor="course-catalog-dept" className="sr-only">
                Department
              </label>
              <select
                id="course-catalog-dept"
                value={draftDepartmentId}
                onChange={(e) => setDraftDepartmentId(e.target.value)}
                className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              >
                <option value="">All departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-blue-600 bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              {pending ? 'Applying…' : 'Apply'}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setDraftQ('')
                setDraftDepartmentId('')
                navigate(1, '', '')
              }}
              className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Clear
            </button>
          </form>
        </div>
      </section>

      {totalCount === 0 ? (
        initialQ.trim() || initialDepartmentId ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <h3 className="text-base font-semibold text-slate-800 sm:text-lg">No matches</h3>
            <p className="mt-1 text-sm text-slate-500">
              Try different keywords or clear filters.
            </p>
            <button
              type="button"
              onClick={() => {
                setDraftQ('')
                setDraftDepartmentId('')
                navigate(1, '', '')
              }}
              className="mt-4 inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Clear filters
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
          <p className="text-xs text-slate-500 sm:text-sm">
            Showing {from}–{to} of {totalCount}
          </p>

          <div className="space-y-10 sm:space-y-12">
            {sections.map((section) => (
              <section key={section.department?.id ?? '_none'} className="space-y-4">
                <div className="border-b border-slate-200 pb-2">
                  <h2 className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
                    {section.department?.name ?? 'Other'}
                  </h2>
                  <p className="text-xs text-slate-500 sm:text-sm">
                    {section.courses.length}{' '}
                    {section.courses.length === 1 ? 'course' : 'courses'}
                  </p>
                </div>
                <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 lg:gap-6">
                  {section.courses.map((course) => (
                    <li key={course.id} className="min-w-0">
                      <CourseCard course={course} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          {page > 1 || hasMore ? (
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              {page > 1 ? (
                <button
                  type="button"
                  onClick={() => navigate(page - 1, initialQ, initialDepartmentId)}
                  disabled={pending}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
                >
                  Previous page
                </button>
              ) : null}
              {hasMore ? (
                <button
                  type="button"
                  onClick={() => navigate(page + 1, initialQ, initialDepartmentId)}
                  disabled={pending}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
                >
                  Next page
                </button>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
