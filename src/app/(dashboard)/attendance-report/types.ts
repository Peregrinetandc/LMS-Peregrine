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

/** Pagination applies only to roster rows inside an opened session (server-side). */
export type AttendanceModuleDetailPagination = {
  page: number
  pageSize: number
}

export type AttendanceSessionListItem = {
  courseId: string
  courseTitle: string
  courseCode: string
  moduleId: string
  moduleTitle: string
  moduleType: 'live_session' | 'offline_session'
  weekIndex: number
  sortOrder: number
  submittedAt: string | null
  total: number
  present: number
  absent: number
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
