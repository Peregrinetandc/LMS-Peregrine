/** Group course modules for syllabus UI: Week 1, Week 2, … ordered by week_index then sort_order. */

export type ModuleWithSchedule = {
  id: string
  week_index?: number | null
  sort_order?: number | null
}

export type ModuleWithSection = ModuleWithSchedule & {
  section_id?: string | null
}

export type CourseSection = {
  id: string
  title: string
  sort_order?: number | null
}

export type SyllabusGroup<T> = {
  id: string
  title: string
  mods: T[]
}

/**
 * Group modules by their `section_id` using titles from the `sections` table.
 * Sections render in `sort_order` (then title). Modules without a section fall
 * into a trailing "Course Content" bucket. If no sections exist at all, falls
 * back to week-based grouping so legacy courses still render.
 */
export function groupModulesBySection<T extends ModuleWithSection>(
  modules: T[],
  sections: CourseSection[],
): SyllabusGroup<T>[] {
  if (sections.length === 0) {
    return groupModulesByWeek(modules)
  }

  const orderedSections = [...sections].sort((a, b) => {
    const sa = a.sort_order ?? 0
    const sb = b.sort_order ?? 0
    if (sa !== sb) return sa - sb
    return a.title.localeCompare(b.title)
  })

  const byId = new Map<string, T[]>()
  for (const sec of orderedSections) byId.set(sec.id, [])
  const orphans: T[] = []

  for (const m of modules) {
    const sid = m.section_id ?? null
    if (sid && byId.has(sid)) {
      byId.get(sid)!.push(m)
    } else {
      orphans.push(m)
    }
  }

  const sortMods = (arr: T[]) =>
    arr.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

  const groups: SyllabusGroup<T>[] = orderedSections.map((sec) => ({
    id: sec.id,
    title: sec.title,
    mods: sortMods(byId.get(sec.id)!),
  }))

  if (orphans.length > 0) {
    groups.push({
      id: 'section-uncategorized',
      title: 'Course Content',
      mods: sortMods(orphans),
    })
  }

  return groups
}

export function groupModulesByWeek<T extends ModuleWithSchedule>(modules: T[]): {
  id: string
  title: string
  mods: T[]
}[] {
  const sorted = [...modules].sort((a, b) => {
    const wa = a.week_index ?? 1
    const wb = b.week_index ?? 1
    if (wa !== wb) return wa - wb
    return (a.sort_order ?? 0) - (b.sort_order ?? 0)
  })

  const weekOrder: number[] = []
  const byWeek = new Map<number, T[]>()

  for (const m of sorted) {
    const w = m.week_index ?? 1
    if (!byWeek.has(w)) {
      byWeek.set(w, [])
      weekOrder.push(w)
    }
    byWeek.get(w)!.push(m)
  }

  weekOrder.sort((a, b) => a - b)

  return weekOrder.map((w) => ({
    id: `week-${w}`,
    title: `Week ${w}`,
    mods: byWeek.get(w)!,
  }))
}
