import { BookOpen, BarChart3, Users } from 'lucide-react'
import { AppCard } from '@/components/ui/primitives'

const features = [
  {
    icon: BookOpen,
    title: 'Structured Courses',
    description:
      'Organized curriculum with lessons, videos, quizzes, and assignments to guide your learning.',
    color: 'bg-emerald-100 text-emerald-700',
  },
  {
    icon: BarChart3,
    title: 'Track Progress',
    description:
      'Monitor your learning journey with progress tracking, attendance records, and grades.',
    color: 'bg-teal-100 text-teal-700',
  },
  {
    icon: Users,
    title: 'Expert Instructors',
    description:
      'Learn from qualified instructors who provide guidance, feedback, and grading on your work.',
    color: 'bg-green-100 text-green-700',
  },
]

export function FeaturesSection() {
  return (
    <section className="bg-slate-50 py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Why Peregrine LMS?
          </h2>
          <p className="mt-2 text-sm text-slate-600 sm:text-base">
            Everything you need for an effective learning experience.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <AppCard key={f.title} className="p-6">
              <div
                className={`inline-flex h-11 w-11 items-center justify-center rounded-lg ${f.color}`}
              >
                <f.icon className="h-5 w-5" aria-hidden />
              </div>
              <h3 className="mt-4 text-base font-semibold text-slate-900">
                {f.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                {f.description}
              </p>
            </AppCard>
          ))}
        </div>
      </div>
    </section>
  )
}
