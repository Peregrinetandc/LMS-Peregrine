'use client'

import { useMemo, useState, useTransition } from 'react'
import { fetchAttendanceModuleDetail, fetchAttendanceReport } from './actions'
import type {
  AttendancePresenceFilter,
  AttendanceReportCourseOption,
  AttendanceReportFilters,
  AttendanceReportRow,
  AttendanceSessionTypeFilter,
} from './types'

type DetailPresenceFilter = 'all' | 'present' | 'absent'

type ModuleSummary = {
  key: string
  courseTitle: string
  courseCode: string
  courseId: string
  moduleId: string
  moduleTitle: string
  moduleType: 'live_session' | 'offline_session'
  weekIndex: number
  submittedAt: string | null
  total: number
  present: number
  absent: number
}

function formatType(t: string) {
  return t.replace('_', ' ')
}

function safeDate(s: string | null) {
  if (!s) return null
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return null
  return d
}

export default function AttendanceReportClient({
  courses,
}: {
  courses: AttendanceReportCourseOption[]
}) {
  const [filters, setFilters] = useState<AttendanceReportFilters>({
    courseId: 'all',
    sessionType: 'all',
    fromDate: '',
    toDate: '',
    learnerQuery: '',
    presence: 'all',
  })

  const [rows, setRows] = useState<AttendanceReportRow[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const [pageSize, setPageSize] = useState(100)
  const [totalCount, setTotalCount] = useState(0)
  const [serverPage, setServerPage] = useState(1)

  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null)
  const [moduleDetailRows, setModuleDetailRows] = useState<AttendanceReportRow[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [detailPresence, setDetailPresence] = useState<DetailPresenceFilter>('all')
  const [detailLearnerSearch, setDetailLearnerSearch] = useState('')

  function resetDetailPanel() {
    setSelectedModuleId(null)
    setModuleDetailRows([])
    setDetailLoading(false)
    setDetailError(null)
    setDetailPresence('all')
    setDetailLearnerSearch('')
  }

  function openSessionDetail(courseId: string, moduleId: string) {
    if (selectedModuleId === moduleId) {
      resetDetailPanel()
      return
    }
    setDetailPresence('all')
    setDetailLearnerSearch('')
    setSelectedModuleId(moduleId)
    setDetailLoading(true)
    setDetailError(null)
    setModuleDetailRows([])
    void (async () => {
      const res = await fetchAttendanceModuleDetail({ courseId, moduleId })
      setDetailLoading(false)
      if ('error' in res) {
        setDetailError(res.error)
        setModuleDetailRows([])
        return
      }
      setModuleDetailRows(res.rows)
    })()
  }

  function updateFilter<K extends keyof AttendanceReportFilters>(key: K, value: AttendanceReportFilters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  function loadReport(nextPage: number, nextPageSize: number) {
    setErr(null)
    startTransition(async () => {
      const res = await fetchAttendanceReport({
        filters,
        pagination: { page: nextPage, pageSize: nextPageSize },
      })
      if ('error' in res) {
        setErr(res.error)
        setRows([])
        setTotalCount(0)
        setServerPage(1)
        resetDetailPanel()
        return
      }
      setRows(res.rows)
      setTotalCount(res.totalCount)
      setServerPage(res.page)
      setPageSize(res.pageSize)
      resetDetailPanel()
    })
  }

  function run() {
    loadReport(1, pageSize)
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  const moduleSummaries = useMemo(() => {
    const map = new Map<string, ModuleSummary>()

    for (const r of rows) {
      const key = `${r.courseId}:${r.moduleId}`
      const curr =
        map.get(key) ??
        ({
          key,
          courseTitle: r.courseTitle,
          courseCode: r.courseCode,
          courseId: r.courseId,
          moduleId: r.moduleId,
          moduleTitle: r.moduleTitle,
          moduleType: r.moduleType,
          weekIndex: r.weekIndex,
          submittedAt: null,
          total: 0,
          present: 0,
          absent: 0,
        } satisfies ModuleSummary)

      curr.total += 1
      if (r.isPresent) curr.present += 1
      else curr.absent += 1

      // When submitted, all rows share the same timestamp. Use the latest non-null value.
      if (r.rosterSubmittedAt) {
        const existing = safeDate(curr.submittedAt)
        const next = safeDate(r.rosterSubmittedAt)
        if (!existing || (next && next > existing)) curr.submittedAt = r.rosterSubmittedAt
      }

      map.set(key, curr)
    }

    return Array.from(map.values()).sort((a, b) => {
      return (
        a.courseTitle.localeCompare(b.courseTitle) ||
        a.weekIndex - b.weekIndex ||
        a.moduleTitle.localeCompare(b.moduleTitle)
      )
    })
  }, [rows])

  const detailStats = useMemo(() => {
    const total = moduleDetailRows.length
    const present = moduleDetailRows.reduce((n, r) => n + (r.isPresent ? 1 : 0), 0)
    return { total, present, absent: total - present }
  }, [moduleDetailRows])

  const filteredDetailRows = useMemo(() => {
    let list = moduleDetailRows
    if (detailPresence === 'present') list = list.filter((r) => r.isPresent)
    if (detailPresence === 'absent') list = list.filter((r) => !r.isPresent)
    const q = detailLearnerSearch.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (r) =>
          (r.learnerName ?? '').toLowerCase().includes(q) ||
          r.learnerId.toLowerCase().includes(q),
      )
    }
    return [...list].sort((a, b) => {
      const an = (a.learnerName ?? '').toLowerCase()
      const bn = (b.learnerName ?? '').toLowerCase()
      return an.localeCompare(bn) || a.learnerId.localeCompare(b.learnerId)
    })
  }, [moduleDetailRows, detailPresence, detailLearnerSearch])

  const detailHeader = moduleDetailRows[0]

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px]">
            <label className="mb-1 block text-sm font-medium text-slate-700">Course</label>
            <select
              value={filters.courseId}
              onChange={(e) => updateFilter('courseId', (e.target.value || 'all') as any)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            >
              <option value="all">All courses</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} ({c.course_code})
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-[180px]">
            <label className="mb-1 block text-sm font-medium text-slate-700">Session type</label>
            <select
              value={filters.sessionType}
              onChange={(e) => updateFilter('sessionType', (e.target.value || 'all') as AttendanceSessionTypeFilter)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            >
              <option value="all">All</option>
              <option value="live_session">Live session</option>
              <option value="offline_session">Offline session</option>
            </select>
          </div>

          <div className="min-w-[180px]">
            <label className="mb-1 block text-sm font-medium text-slate-700">Presence</label>
            <select
              value={filters.presence}
              onChange={(e) => updateFilter('presence', (e.target.value || 'all') as AttendancePresenceFilter)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            >
              <option value="all">All</option>
              <option value="present">Present only</option>
              <option value="absent">Absent only</option>
            </select>
          </div>

          <div className="min-w-[180px]">
            <label className="mb-1 block text-sm font-medium text-slate-700">From (submitted date)</label>
            <input
              type="date"
              value={filters.fromDate}
              onChange={(e) => updateFilter('fromDate', e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            />
          </div>

          <div className="min-w-[180px]">
            <label className="mb-1 block text-sm font-medium text-slate-700">To (submitted date)</label>
            <input
              type="date"
              value={filters.toDate}
              onChange={(e) => updateFilter('toDate', e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            />
          </div>

          <div className="min-w-[240px] flex-1">
            <label className="mb-1 block text-sm font-medium text-slate-700">Learner search</label>
            <input
              type="text"
              value={filters.learnerQuery}
              onChange={(e) => updateFilter('learnerQuery', e.target.value)}
              placeholder="Type a learner name…"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400"
            />
          </div>

          <div className="min-w-[120px]">
            <label className="mb-1 block text-sm font-medium text-slate-700">Per page</label>
            <select
              value={pageSize}
              onChange={(e) => {
                const next = Number(e.target.value)
                setPageSize(next)
                if (totalCount > 0) loadReport(1, next)
              }}
              disabled={isPending}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:opacity-60"
            >
              {[25, 50, 100, 200].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={run}
              disabled={isPending}
              className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
            >
              {isPending ? 'Loading…' : 'Load report'}
            </button>
          </div>
        </div>

        {err && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {err}
          </div>
        )}

        <p className="mt-3 text-xs text-slate-500">
          Data loads in pages (max 200 rows per request). Date filters use attendance submission time. Session
          summaries below only include roster rows on the current page—narrow filters or change page for more.
        </p>

        {totalCount > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <p className="text-sm text-slate-600">
              <span className="font-medium text-slate-800">{totalCount.toLocaleString()}</span> row
              {totalCount === 1 ? '' : 's'} total · page{' '}
              <span className="font-medium text-slate-800">{serverPage}</span> of{' '}
              <span className="font-medium text-slate-800">{totalPages}</span>
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={isPending || serverPage <= 1}
                onClick={() => loadReport(serverPage - 1, pageSize)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={isPending || serverPage >= totalPages}
                onClick={() => loadReport(serverPage + 1, pageSize)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-900">Sessions (this page)</h2>
          <p className="text-sm text-slate-600">
            {moduleSummaries.length} session{moduleSummaries.length === 1 ? '' : 's'}
          </p>
        </div>

        {moduleSummaries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white py-12 text-center text-sm text-slate-500">
            No attendance records match your filters yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100 text-left text-slate-600">
                  <th className="p-3 font-medium">Course</th>
                  <th className="p-3 font-medium">Session</th>
                  <th className="p-3 font-medium">Type</th>
                  <th className="p-3 font-medium">Week</th>
                  <th className="p-3 font-medium">Submitted</th>
                  <th className="p-3 font-medium text-right">Present</th>
                  <th className="p-3 font-medium text-right">Absent</th>
                  <th className="p-3 font-medium text-right">Total</th>
                  <th className="p-3 w-36 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {moduleSummaries.map((m) => {
                  const active = selectedModuleId === m.moduleId
                  return (
                    <tr
                      key={m.key}
                      className={`border-b border-slate-100 hover:bg-slate-50/80 ${
                        active ? 'bg-blue-50/60' : ''
                      }`}
                    >
                      <td className="p-3 text-slate-800">
                        <span className="font-medium">{m.courseTitle}</span>
                        <span className="block text-xs text-slate-500">{m.courseCode}</span>
                      </td>
                      <td className="p-3 font-medium text-slate-800">{m.moduleTitle}</td>
                      <td className="p-3 capitalize text-slate-600">{formatType(m.moduleType)}</td>
                      <td className="p-3 text-slate-600">{m.weekIndex}</td>
                      <td className="p-3 text-slate-600">
                        {m.submittedAt ? new Date(m.submittedAt).toLocaleString() : '—'}
                      </td>
                      <td className="p-3 text-right font-semibold text-emerald-700">{m.present}</td>
                      <td className="p-3 text-right font-semibold text-rose-700">{m.absent}</td>
                      <td className="p-3 text-right font-semibold text-slate-800">{m.total}</td>
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={() => openSessionDetail(m.courseId, m.moduleId)}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                            active
                              ? 'border-blue-300 bg-blue-50 text-blue-800 hover:bg-blue-100'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                          title={
                            active
                              ? 'Hide roster for this session'
                              : 'View full roster (present / absent) for this session'
                          }
                        >
                          {active ? 'Hide' : 'View details'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedModuleId && (
        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Session Attendance</h2>
              {detailHeader ? (
                <p className="mt-0.5 text-sm text-slate-600">
                  {detailHeader.courseTitle} · Week {detailHeader.weekIndex} · {detailHeader.moduleTitle}
                </p>
              ) : null}
              {!detailLoading && !detailError && moduleDetailRows.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                    Total {detailStats.total}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                    Present {detailStats.present}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-800">
                    Absent {detailStats.absent}
                  </span>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={resetDetailPanel}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Close
            </button>
          </div>

          {detailLoading && (
            <p className="text-sm text-slate-500">Loading session attendance…</p>
          )}
          {detailError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
              {detailError}
            </div>
          )}

          {!detailLoading && !detailError && moduleDetailRows.length > 0 && (
            <>
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[160px]">
                  <label className="mb-1 block text-xs font-medium text-slate-700">Show</label>
                  <select
                    value={detailPresence}
                    onChange={(e) => setDetailPresence((e.target.value || 'all') as DetailPresenceFilter)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  >
                    <option value="all">All learners</option>
                    <option value="present">Present only</option>
                    <option value="absent">Absent only</option>
                  </select>
                </div>
                <div className="min-w-[200px] flex-1">
                  <label className="mb-1 block text-xs font-medium text-slate-700">Search learner</label>
                  <input
                    type="text"
                    value={detailLearnerSearch}
                    onChange={(e) => setDetailLearnerSearch(e.target.value)}
                    placeholder="Filter by name…"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400"
                  />
                </div>
              </div>
              <p className="text-sm text-slate-600">
                Showing{' '}
                <span className="font-medium text-slate-900">{filteredDetailRows.length}</span> of{' '}
                {moduleDetailRows.length} enrolled
              </p>
            </>
          )}

          {!detailLoading && !detailError && moduleDetailRows.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                    <th className="p-3 font-medium">Learner</th>
                    <th className="p-3 font-medium">Status</th>
                    <th className="p-3 font-medium">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDetailRows.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="p-6 text-center text-slate-500">
                        No learners match this filter.
                      </td>
                    </tr>
                  ) : (
                    filteredDetailRows.map((r) => (
                      <tr key={r.rosterRowId} className="border-b border-slate-100">
                        <td className="p-3 font-medium text-slate-900">
                          {r.learnerName ?? r.learnerId.slice(0, 8)}
                          {r.learnerName ? null : (
                            <span className="ml-2 text-xs text-slate-500">(no name)</span>
                          )}
                        </td>
                        <td className="p-3">
                          {r.isPresent ? (
                            <span className="font-semibold text-emerald-700">Present</span>
                          ) : (
                            <span className="font-semibold text-rose-700">Absent</span>
                          )}
                        </td>
                        <td className="p-3 text-slate-600">
                          {r.updatedAt ? new Date(r.updatedAt).toLocaleString() : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {!detailLoading && !detailError && moduleDetailRows.length === 0 && (
            <p className="text-sm text-slate-500">No session attendance for this session yet.</p>
          )}
        </section>
      )}
    </div>
  )
}

