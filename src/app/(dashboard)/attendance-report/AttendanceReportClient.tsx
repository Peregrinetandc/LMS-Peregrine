'use client'

import { useMemo, useState, useTransition, useRef } from 'react'
import { fetchAttendanceModuleDetail, fetchAttendanceSessionList } from './actions'
import type {
  AttendanceReportFilters,
  AttendanceReportRow,
  AttendanceReportCourseOption,
  AttendanceSessionListItem,
} from './types'
import { useVirtualizer } from '@tanstack/react-virtual'

function formatType(t: string) {
  return t.replace('_', ' ')
}

function AttendanceDetailTable({ list }: { list: AttendanceReportRow[] }) {
  const parentRef = useRef<HTMLDivElement>(null)

  const rowVirtualizer = useVirtualizer({
    count: list.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 45,
    overscan: 10,
  })

  return (
    <div
      ref={parentRef}
      className="overflow-auto max-h-[400px] rounded-xl border border-slate-200"
    >
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        <div className="sticky top-0 z-10 flex border-b border-slate-200 bg-slate-50 text-sm font-medium text-slate-600 shadow-sm">
          <div className="flex-[2] p-3">Learner</div>
          <div className="flex-1 p-3">Status</div>
          <div className="flex-1 p-3">Updated</div>
        </div>
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const r = list[virtualRow.index]
          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={rowVirtualizer.measureElement}
              className="absolute left-0 top-0 flex w-full border-b border-slate-100 bg-white text-sm hover:bg-slate-50/80"
              style={{
                transform: `translateY(${virtualRow.start}px)`,
                marginTop: '45px',
              }}
            >
              <div className="flex-[2] p-3 font-medium text-slate-900">
                {r.learnerName ?? r.learnerId.slice(0, 8)}
                {r.learnerName ? null : (
                  <span className="ml-2 text-xs text-slate-500">(no name)</span>
                )}
              </div>
              <div className="flex-1 p-3">
                {r.isPresent ? (
                  <span className="font-semibold text-emerald-700">Present</span>
                ) : (
                  <span className="font-semibold text-rose-700">Absent</span>
                )}
              </div>
              <div className="flex-1 p-3 text-slate-600">
                {r.updatedAt ? new Date(r.updatedAt).toLocaleString() : '—'}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

type CourseGroup = {
  courseId: string
  courseTitle: string
  courseCode: string
  sessions: AttendanceSessionListItem[]
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

  const [sessions, setSessions] = useState<AttendanceSessionListItem[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null)
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null)
  const [selectedSessionMeta, setSelectedSessionMeta] = useState<AttendanceSessionListItem | null>(null)

  const [moduleDetailRows, setModuleDetailRows] = useState<AttendanceReportRow[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [detailPage, setDetailPage] = useState(1)
  const [detailPageSize, setDetailPageSize] = useState(50)
  const [detailTotalCount, setDetailTotalCount] = useState(0)

  const detailFiltersRef = useRef(filters)
  detailFiltersRef.current = filters

  async function loadDetailPage(courseId: string, moduleId: string, page: number, pageSize: number) {
    setDetailLoading(true)
    setDetailError(null)
    const res = await fetchAttendanceModuleDetail({
      courseId,
      moduleId,
      filters: detailFiltersRef.current,
      pagination: { page, pageSize },
    })
    setDetailLoading(false)
    if ('error' in res) {
      setDetailError(res.error)
      setModuleDetailRows([])
      setDetailTotalCount(0)
      return
    }
    setModuleDetailRows(res.rows)
    setDetailTotalCount(res.totalCount)
    setDetailPage(res.page)
    setDetailPageSize(res.pageSize)
  }

  function resetDetailPanel() {
    setSelectedModuleId(null)
    setSelectedCourseId(null)
    setSelectedSessionMeta(null)
    setModuleDetailRows([])
    setDetailLoading(false)
    setDetailError(null)
    setDetailPage(1)
    setDetailTotalCount(0)
  }

  function openSessionDetail(session: AttendanceSessionListItem) {
    if (selectedModuleId === session.moduleId && selectedCourseId === session.courseId) {
      resetDetailPanel()
      return
    }
    setSelectedCourseId(session.courseId)
    setSelectedModuleId(session.moduleId)
    setSelectedSessionMeta(session)
    setModuleDetailRows([])
    setDetailError(null)
    void loadDetailPage(session.courseId, session.moduleId, 1, detailPageSize)
  }

  function updateFilter<K extends keyof AttendanceReportFilters>(key: K, value: AttendanceReportFilters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  function run() {
    setErr(null)
    startTransition(async () => {
      const res = await fetchAttendanceSessionList(filters)
      if ('error' in res) {
        setErr(res.error)
        setSessions([])
        resetDetailPanel()
        return
      }
      setSessions(res.sessions)
      resetDetailPanel()
    })
  }

  const groupedSessions = useMemo((): CourseGroup[] => {
    if (sessions.length === 0) return []
    if (filters.courseId !== 'all') {
      const s0 = sessions[0]
      return [
        {
          courseId: s0.courseId,
          courseTitle: s0.courseTitle,
          courseCode: s0.courseCode,
          sessions,
        },
      ]
    }
    const byCourse = new Map<string, CourseGroup>()
    for (const s of sessions) {
      const g = byCourse.get(s.courseId)
      if (g) g.sessions.push(s)
      else {
        byCourse.set(s.courseId, {
          courseId: s.courseId,
          courseTitle: s.courseTitle,
          courseCode: s.courseCode,
          sessions: [s],
        })
      }
    }
    return [...byCourse.values()].sort((a, b) => a.courseTitle.localeCompare(b.courseTitle))
  }, [sessions, filters.courseId])

  const detailHeader = moduleDetailRows[0]
  const detailTotalPages = Math.max(1, Math.ceil(detailTotalCount / detailPageSize))
  const detailFrom = detailTotalCount === 0 ? 0 : (detailPage - 1) * detailPageSize + 1
  const detailTo = Math.min(detailPage * detailPageSize, detailTotalCount)

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px]">
            <label className="mb-1 block text-sm font-medium text-slate-700">Course</label>
            <select
              value={filters.courseId}
              onChange={(e) => updateFilter('courseId', (e.target.value || 'all') as AttendanceReportFilters['courseId'])}
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
              onChange={(e) =>
                updateFilter('sessionType', (e.target.value || 'all') as AttendanceReportFilters['sessionType'])
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            >
              <option value="all">All</option>
              <option value="live_session">Online (live session)</option>
              <option value="offline_session">Offline session</option>
            </select>
          </div>

          <div className="min-w-[180px]">
            <label className="mb-1 block text-sm font-medium text-slate-700">Presence</label>
            <select
              value={filters.presence}
              onChange={(e) =>
                updateFilter('presence', (e.target.value || 'all') as AttendanceReportFilters['presence'])
              }
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
              placeholder="Filter by learner name…"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400"
            />
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
          Sessions are listed by course and type (online = live session, offline = offline session). Counts respect
          your filters. Open a session to page through attendance rows for that session only. Date filters use
          roster submission time.
        </p>

        {!isPending && sessions.length > 0 && (
          <p className="mt-2 text-sm text-slate-600">
            <span className="font-medium text-slate-800">{sessions.length}</span> matching session
            {sessions.length === 1 ? '' : 's'}
          </p>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-900">Sessions</h2>
        </div>

        {sessions.length === 0 && !isPending && !err ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white py-12 text-center text-sm text-slate-500">
            Load a report to see live and offline sessions for your selection.
          </div>
        ) : null}

        {sessions.length === 0 && isPending ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white py-12 text-center text-sm text-slate-500">
            Loading…
          </div>
        ) : null}

        {sessions.length > 0 ? (
          <div className="space-y-8">
            {groupedSessions.map((group) => (
              <div key={group.courseId} className="space-y-2">
                {filters.courseId === 'all' ? (
                  <h3 className="text-sm font-semibold text-slate-800">
                    {group.courseTitle}
                    <span className="ml-2 font-normal text-slate-500">({group.courseCode})</span>
                  </h3>
                ) : null}
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-100 text-left text-slate-600">
                        {filters.courseId !== 'all' ? <th className="p-3 font-medium">Course</th> : null}
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
                      {group.sessions.map((m) => {
                        const active =
                          selectedModuleId === m.moduleId && selectedCourseId === m.courseId
                        return (
                          <tr
                            key={`${m.courseId}:${m.moduleId}`}
                            className={`border-b border-slate-100 hover:bg-slate-50/80 ${
                              active ? 'bg-blue-50/60' : ''
                            }`}
                          >
                            {filters.courseId !== 'all' ? (
                              <td className="p-3 text-slate-800">
                                <span className="font-medium">{m.courseTitle}</span>
                                <span className="block text-xs text-slate-500">{m.courseCode}</span>
                              </td>
                            ) : null}
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
                                onClick={() => openSessionDetail(m)}
                                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                                  active
                                    ? 'border-blue-300 bg-blue-50 text-blue-800 hover:bg-blue-100'
                                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                }`}
                                title={
                                  active
                                    ? 'Hide roster for this session'
                                    : 'View attendance for this session (paged)'
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
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {selectedModuleId && selectedCourseId && (
        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Session attendance</h2>
              {detailHeader ? (
                <p className="mt-0.5 text-sm text-slate-600">
                  {detailHeader.courseTitle} · Week {detailHeader.weekIndex} · {detailHeader.moduleTitle}
                </p>
              ) : selectedSessionMeta ? (
                <p className="mt-0.5 text-sm text-slate-600">
                  {selectedSessionMeta.courseTitle} · Week {selectedSessionMeta.weekIndex} ·{' '}
                  {selectedSessionMeta.moduleTitle}
                </p>
              ) : null}
              {selectedSessionMeta && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                    Total {selectedSessionMeta.total}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                    Present {selectedSessionMeta.present}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-800">
                    Absent {selectedSessionMeta.absent}
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

          {detailLoading && <p className="text-sm text-slate-500">Loading attendance…</p>}
          {detailError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
              {detailError}
            </div>
          )}

          {!detailLoading && !detailError && detailTotalCount > 0 && (
            <>
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[120px]">
                  <label className="mb-1 block text-xs font-medium text-slate-700">Rows per page</label>
                  <select
                    value={detailPageSize}
                    onChange={(e) => {
                      const next = Number(e.target.value)
                      if (!selectedCourseId || !selectedModuleId) return
                      void loadDetailPage(selectedCourseId, selectedModuleId, 1, next)
                    }}
                    disabled={detailLoading}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:opacity-60"
                  >
                    {[25, 50, 100, 200].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="text-sm text-slate-600">
                Rows <span className="font-medium text-slate-900">{detailFrom}</span>–
                <span className="font-medium text-slate-900">{detailTo}</span> of{' '}
                <span className="font-medium text-slate-900">{detailTotalCount}</span> (matching filters)
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={detailLoading || detailPage <= 1 || !selectedCourseId || !selectedModuleId}
                  onClick={() => {
                    if (!selectedCourseId || !selectedModuleId) return
                    void loadDetailPage(selectedCourseId, selectedModuleId, detailPage - 1, detailPageSize)
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={
                    detailLoading ||
                    detailPage >= detailTotalPages ||
                    !selectedCourseId ||
                    !selectedModuleId
                  }
                  onClick={() => {
                    if (!selectedCourseId || !selectedModuleId) return
                    void loadDetailPage(selectedCourseId, selectedModuleId, detailPage + 1, detailPageSize)
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
                <span className="text-sm text-slate-600">
                  Page <span className="font-medium text-slate-800">{detailPage}</span> of{' '}
                  <span className="font-medium text-slate-800">{detailTotalPages}</span>
                </span>
              </div>
            </>
          )}

          {!detailLoading && !detailError && moduleDetailRows.length > 0 && (
            <AttendanceDetailTable list={moduleDetailRows} />
          )}

          {!detailLoading && !detailError && detailTotalCount === 0 && (
            <p className="text-sm text-slate-500">No attendance rows match the current filters for this session.</p>
          )}
        </section>
      )}
    </div>
  )
}
