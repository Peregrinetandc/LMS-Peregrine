'use client'

import Link from 'next/link'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { LessonTypeIcon } from '@/components/courses/lesson-type-icon'
import { Check, CheckCircle, ChevronRight, CircleAlert, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'

export type SyllabusWeekMod = {
  id: string
  title: string
  type: string
  variant: 'staff' | 'locked' | 'open'
  href: string
  timeLocked: boolean
  lockDateLabel: string | null
  weekIndex: number | null
  ui: {
    complete: boolean
    overdue: boolean
    in_grading: boolean
    isFailed: boolean
  }
}

export type SyllabusWeek = {
  id: string
  title: string
  mods: SyllabusWeekMod[]
}

type Props = { weeks: SyllabusWeek[] }

export function CourseSyllabusAccordion({ weeks }: Props) {
  const defaultOpen = weeks.length > 0 ? [weeks[0].id] : []

  return (
    <Accordion
      type="multiple"
      defaultValue={defaultOpen}
      className="flex w-full flex-col divide-y shadow-inner divide-border/70"
    >
      {weeks.map((section) => (
        <AccordionItem key={section.id} value={section.id} className=" border-t border-border/100">
          <AccordionTrigger
            className={cn(
              'items-center gap-2 rounded-none border-0 px-5 py-3 hover:no-underline sm:px-8',
              'text-left font-medium [&>svg]:text-muted-foreground',
            )}
          >
            <span className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {section.title}
              </h3>
              <Badge variant="secondary" className="shrink-0 text-[10px] font-medium">
                {section.mods.length} lesson{section.mods.length === 1 ? '' : 's'}
              </Badge>
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-0 pt-0 [&_a]:no-underline [&_a:hover]:no-underline [&_p]:mb-0">
            {section.mods.length === 0 ? (
              <div className="px-5 pb-3 sm:px-8">
                <p className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                  No lessons in this section yet.
                </p>
              </div>
            ) : (
              <div className="flex flex-col border-t border-border/60 divide-y divide-border/70">
                {section.mods.map((mod) => {
                  if (mod.variant === 'staff') {
                    return (
                      <Link
                        key={mod.id}
                        href={mod.href}
                        className="group flex w-full min-h-11 flex-col gap-2 bg-transparent px-5 py-2.5 transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:gap-3 sm:px-8"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <LessonTypeIcon type={mod.type} />
                          <span className="flex-1 truncate text-sm font-medium text-foreground group-hover:text-accent-foreground">
                            {mod.title}
                          </span>
                          <ChevronRight
                            className="hidden size-4 shrink-0 text-muted-foreground group-hover:text-primary sm:block"
                            aria-hidden
                          />
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground sm:justify-end">
                          {mod.weekIndex != null && (
                            <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                              Wk {mod.weekIndex}
                            </span>
                          )}
                          {mod.timeLocked && mod.lockDateLabel && (
                            <span className="inline-flex items-center gap-1">
                              <Lock className="size-3 shrink-0" aria-hidden />
                              {mod.lockDateLabel}
                            </span>
                          )}
                        </div>
                      </Link>
                    )
                  }

                  if (mod.variant === 'locked') {
                    return (
                      <div
                        key={mod.id}
                        className="flex w-full min-h-11 flex-col gap-2 bg-muted/40 px-5 py-2.5 sm:flex-row sm:items-center sm:gap-3 sm:px-8"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <LessonTypeIcon type={mod.type} />
                          <span className="flex-1 truncate text-xs text-muted-foreground">{mod.title}</span>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-2 justify-end">
                          {mod.weekIndex != null && (
                            <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                              Wk {mod.weekIndex}
                            </span>
                          )}
                          {mod.timeLocked && mod.lockDateLabel && (
                            <span className="text-xs text-muted-foreground">
                              Unlocks at {mod.lockDateLabel}
                            </span>
                          )}
                          <Lock className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                        </div>
                      </div>
                    )
                  }

                  return (
                    <Link
                      key={mod.id}
                      href={mod.href}
                      className="group flex w-full min-h-11 flex-col gap-2 bg-transparent px-5 py-2.5 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:gap-3 sm:px-8"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <LessonTypeIcon type={mod.type} />
                        <span className="flex-1 truncate text-xs font-medium text-foreground group-hover:text-accent-foreground">
                          {mod.title}
                        </span>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                        {mod.weekIndex != null && (
                          <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                            Wk {mod.weekIndex}
                          </span>
                        )}
                        {mod.ui.complete && (
                          <span className="shrink-0 text-emerald-600" title="Completed" aria-label="Completed">
                            <CheckCircle className="size-4 shrink-0" aria-hidden />
                          </span>
                        )}
                        {mod.ui.overdue && (
                          <span className="shrink-0 rounded rounded-lg bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                            Overdue
                          </span>
                        )}
                        {mod.ui.in_grading && (
                          <span
                            className="shrink-0 rounded rounded-lg bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700"
                            title="In grading"
                          >
                            In grading
                          </span>
                        )}
                        {mod.ui.isFailed && (
                          <CircleAlert className="size-4 shrink-0 text-amber-500" aria-label="Not passed" />
                        )}
                        <ChevronRight
                          className="size-4 shrink-0 text-slate-300 group-hover:text-blue-500"
                          aria-hidden
                        />
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}
