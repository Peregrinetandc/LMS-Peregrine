import Image from 'next/image'
import Link from 'next/link'
import { BookOpen, ChevronRight, Users } from 'lucide-react'
import { toRenderableImageUrl } from '@/lib/drive-image'
import type { CatalogCourse } from '@/lib/catalog-courses'
import { finalPrice, formatINR } from '@/lib/course-price'

export type CourseCardVariant = 'featured' | 'compact'

function instructorName(course: CatalogCourse): string {
  const p = course.profiles as { full_name?: string } | null | undefined
  return p?.full_name?.trim() || 'Instructor'
}

export function CourseCard({
  course,
  variant = 'compact',
}: {
  course: CatalogCourse
  variant?: CourseCardVariant
}) {
  const open = course.enrollment_type === 'open'
  const price = Number(course.price ?? 0)
  const discount = Number(course.discount_percent ?? 0)
  const final = finalPrice({ price, discount_percent: discount })
  const showStrike = price > 0 && discount > 0
  const departmentName = course.department?.name?.trim() || null

  const priceBlock =
    price <= 0 ? (
      <span className="inline-flex shrink-0 items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
        Free
      </span>
    ) : (
      <span className="inline-flex shrink-0 items-baseline gap-1.5">
        {showStrike && (
          <span className="text-[11px] text-slate-400 line-through">{formatINR(price)}</span>
        )}
        <span className="text-sm font-semibold text-slate-900">{formatINR(final)}</span>
        {showStrike && (
          <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-200">
            {Math.round(discount)}% off
          </span>
        )}
      </span>
    )

  // Shared root link styles. Mobile layout is variant-driven; from sm: up they converge.
  const rootBase =
    'group relative flex h-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm ring-slate-200/60 transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2'

  const rootByVariant =
    variant === 'compact'
      ? 'flex-row sm:flex-col'
      : 'flex-col'

  // Image wrapper: compact mobile is a fixed-width thumbnail (no overlay), otherwise full-width hero with overlay.
  const imageWrapperByVariant =
    variant === 'compact'
      ? 'relative w-32 shrink-0 self-stretch bg-gradient-to-br from-slate-100 via-slate-50 to-indigo-100 sm:aspect-[16/10] sm:w-full sm:self-auto'
      : 'relative w-full bg-gradient-to-br from-slate-100 via-slate-50 to-indigo-100 aspect-[4/3] sm:aspect-[16/10]'

  const showOverlayTitle = variant === 'featured' || /* sm+ shared */ true
  // Overlay rendered always (it visually sits on the image for stacked layouts);
  // for compact mobile we hide it via responsive classes since the image is small.

  return (
    <Link
      href={`/courses/${course.id}`}
      className={`${rootBase} ${rootByVariant}`}
    >
      <div className={imageWrapperByVariant}>
        {course.thumbnail_url ? (
          <Image
            src={toRenderableImageUrl(course.thumbnail_url)}
            alt={course.title}
            fill
            className="object-cover transition duration-300 group-hover:scale-[1.03]"
            sizes={
              variant === 'compact'
                ? '(max-width: 640px) 128px, (max-width: 1024px) 50vw, 33vw'
                : '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw'
            }
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <BookOpen className="h-10 w-10 text-indigo-300 sm:h-14 sm:w-14" aria-hidden />
          </div>
        )}

        {/* Top badges: department (left), enrollment (right). Hidden on compact mobile to avoid clutter on small thumb. */}
        {departmentName ? (
          <span
            className={`absolute left-2 top-2 max-w-[60%] truncate rounded-full bg-white/85 px-2 py-0.5 text-[10px] font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 backdrop-blur-sm sm:left-3 sm:top-3 sm:text-[11px] ${
              variant === 'compact' ? 'hidden sm:inline-block' : ''
            }`}
          >
            {departmentName}
          </span>
        ) : null}
        <span
          className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-semibold shadow-sm backdrop-blur-sm sm:right-3 sm:top-3 ${
            open ? 'bg-emerald-600/90 text-white' : 'bg-amber-500/95 text-white'
          } ${variant === 'compact' ? 'hidden sm:inline-block' : ''}`}
        >
          {open ? 'Open' : 'Invite only'}
        </span>

        {/* Bottom gradient + overlay title. Shown for featured (any size) and for compact at sm+. Hidden on compact mobile thumb. */}
        {showOverlayTitle ? (
          <div
            className={`pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-gradient-to-t from-black/75 via-black/45 to-transparent p-3 sm:p-4 ${
              variant === 'compact' ? 'hidden sm:flex' : ''
            }`}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide text-white/85 sm:text-[11px]">
              {course.course_code}
            </p>
            <h2
              className={`line-clamp-2 font-semibold leading-snug text-white ${
                variant === 'featured'
                  ? 'text-lg sm:text-base'
                  : 'text-base'
              }`}
            >
              {course.title}
            </h2>
          </div>
        ) : null}
      </div>

      {/* Body */}
      <div
        className={`flex min-w-0 min-h-0 flex-1 flex-col gap-2 ${
          variant === 'compact' ? 'p-3 sm:p-4' : 'p-3.5 sm:p-4'
        }`}
      >
        {/* Compact-mobile-only header: course_code + title shown in text column since not on the image. */}
        {variant === 'compact' ? (
          <div className="flex flex-col gap-1 sm:hidden">
            <div className="flex items-center gap-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                {course.course_code}
              </p>
              <span
                className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
                  open
                    ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                    : 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
                }`}
              >
                {open ? 'Open' : 'Invite'}
              </span>
              {departmentName ? (
                <span className="truncate rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-600">
                  {departmentName}
                </span>
              ) : null}
            </div>
            <h2 className="line-clamp-2 text-[15px] font-semibold leading-snug text-slate-900 group-hover:text-blue-700">
              {course.title}
            </h2>
          </div>
        ) : null}

        {/* Description — shown for featured everywhere, for compact only at sm+ (mobile row hides it for density). */}
        <p
          className={`line-clamp-2 text-xs leading-relaxed bg-white text-slate-600 ${
            variant === 'compact' ? 'hidden sm:block' : ''
          }`}
        >
          {course.description?.trim() || 'Explore this course to see lessons and materials.'}
        </p>

        {/* Footer: instructor + price */}
        <div
          className={`flex items-center justify-between gap-2 ${
            variant === 'compact'
              ? 'mt-auto pt-1 sm:border-t sm:border-slate-100 sm:pt-3'
              : 'mt-1 border-t border-slate-100 pt-3'
          }`}
        >
          <span className="flex min-w-0 items-center gap-1.5 text-xs text-slate-500">
            <Users className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
            <span className="truncate">{instructorName(course)}</span>
          </span>
          {priceBlock}
        </div>

        {/* View chevron — hidden on compact mobile to keep rows tight */}
        <div
          className={`flex justify-end ${variant === 'compact' ? 'hidden sm:flex' : ''}`}
        >
          <span className="inline-flex shrink-0 items-center gap-0.5 text-xs font-semibold text-blue-600">
            View
            <ChevronRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" aria-hidden />
          </span>
        </div>
      </div>
    </Link>
  )
}
