export const ROLES = {
  ADMIN: 'admin',
  INSTRUCTOR: 'instructor',
  LEARNER: 'learner',
  COORDINATOR: 'coordinator',
} as const

export type Role = (typeof ROLES)[keyof typeof ROLES]

export function isInstructorRole(role: string | null | undefined): boolean {
  return role === ROLES.INSTRUCTOR || role === ROLES.ADMIN
}

export function isStaffRole(role: string | null | undefined): boolean {
  return (
    role === ROLES.INSTRUCTOR ||
    role === ROLES.ADMIN ||
    role === ROLES.COORDINATOR
  )
}
