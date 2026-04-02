export type AttendanceReportCourseOption = {
  id: string
  title: string
  course_code: string
}

export type AttendanceSessionTypeFilter = 'all' | 'live_session' | 'offline_session'

export type AttendancePresenceFilter = 'all' | 'present' | 'absent'

export type AttendanceReportFilters = {
  courseId: string | 'all'
  sessionType: AttendanceSessionTypeFilter
  /** ISO date string (YYYY-MM-DD) */
  fromDate: string
  /** ISO date string (YYYY-MM-DD) */
  toDate: string
  learnerQuery: string
  presence: AttendancePresenceFilter
}

/** Pagination for roster query (default pageSize in client). */
export type AttendanceReportPagination = {
  page: number
  pageSize: number
}

export type AttendanceReportFetchInput = {
  filters: AttendanceReportFilters
  pagination?: AttendanceReportPagination
}

export type AttendanceReportRow = {
  moduleId: string
  moduleTitle: string
  moduleType: 'live_session' | 'offline_session'
  weekIndex: number
  courseId: string
  courseTitle: string
  courseCode: string

  rosterRowId: string
  learnerId: string
  learnerName: string | null
  isPresent: boolean
  rosterSubmittedAt: string | null
  updatedAt: string | null
}

