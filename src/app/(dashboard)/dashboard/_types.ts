import type { ReactNode } from 'react'

/** Shape returned by the `dashboard_learner_summary_v1` RPC. */
export type LearnerSummary = {
  enrolled_courses: {
    id: string
    course_code: string
    title: string
    thumbnail_url: string | null
    total_modules: number
    completed_modules: number
    progress: number
  }[]
  streak: number | null
  due_assignments_count: number
  due_assignments: {
    assignment_id: string
    module_id: string
    module_title: string
    course_id: string
    course_title: string
    deadline_at: string
  }[]
}

/** A single due assignment row — used by both the dashboard list and the
 *  dedicated /dashboard/due-assignments page (which adds course_code). */
export type DueAssignment = {
  assignment_id: string
  module_id: string
  module_title: string
  course_id: string
  course_title: string
  course_code?: string | null
  deadline_at: string
}

/** Shape returned by the `learner_due_assignments_v1(limit, offset)` RPC. */
export type DueAssignmentsPage = {
  total: number
  items: DueAssignment[]
  limit: number
  offset: number
}

/** Shape returned by the `dashboard_instructor_summary_v1` RPC. */
export type InstructorSummary = {
  courses: {
    id: string
    course_code: string
    title: string
    status: string
    created_at: string
    enrollment_count: number
    department_name: string | null
  }[]
}

/** A single metric card displayed at the top of the dashboard. */
export type MetricCard = {
  label: string
  value: number
  icon: ReactNode
  bg: string
  hint?: string
  /** When set, the card renders as a link to this href. */
  href?: string
}
