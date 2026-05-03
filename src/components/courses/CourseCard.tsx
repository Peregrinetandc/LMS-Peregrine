import Image from 'next/image'
import Link from 'next/link'
import { BookOpen, ChevronRight, Users } from 'lucide-react'
import { toRenderableImageUrl } from '@/lib/drive-image'
import type { CatalogCourse } from '@/lib/catalog-courses'

function instructorName(course: CatalogCourse): string {
  const p = course.profiles as { full_name?: string } | null | undefined
  return p?.full_name?.trim() || 'Instructor'
}

export function CourseCard({ course }: { course: CatalogCourse }) {
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
