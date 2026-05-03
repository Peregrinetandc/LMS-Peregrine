import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import type { CatalogCourse } from '@/lib/catalog-courses'
import { CourseCard } from '@/components/courses/CourseCard'

export function FeaturedCourses({ courses }: { courses: CatalogCourse[] }) {
  if (courses.length === 0) return null

  return (
    <section className="py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Featured Courses
          </h2>
          <p className="mt-2 text-sm text-slate-600 sm:text-base">
            Explore our latest published courses and start learning today.
          </p>
        </div>

        <ul className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 lg:gap-6">
          {courses.map((course) => (
            <li key={course.id} className="min-w-0">
              <CourseCard course={course} />
            </li>
          ))}
        </ul>

        <div className="mt-10 text-center">
          <Link
            href="/courses"
            className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 transition hover:text-emerald-800"
          >
            View All Courses
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  )
}
