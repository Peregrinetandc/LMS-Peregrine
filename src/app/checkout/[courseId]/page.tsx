import Image from 'next/image'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, BookOpen, Clock, ShieldCheck } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { finalPrice, formatINR } from '@/lib/course-price'
import { CheckoutForm } from '@/components/checkout/CheckoutForm'
import { toRenderableImageUrl } from '@/lib/drive-image'
import { BLUR_DATA_URL } from '@/lib/image-placeholder'

type CourseRow = {
  id: string
  title: string
  description: string | null
  thumbnail_url: string | null
  price: number | null
  discount_percent: number | null
}

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ courseId: string }>
}) {
  const { courseId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect(
      `/login?redirect=${encodeURIComponent(`/checkout/${courseId}`)}&notice=auth_required`,
    )
  }

  const { data: course } = await supabase
    .from('courses')
    .select('id, title, description, thumbnail_url, price, discount_percent')
    .eq('id', courseId)
    .single<CourseRow>()
  if (!course) notFound()

  const price = Number(course.price ?? 0)
  const discountPercent = Number(course.discount_percent ?? 0)
  const baseFinal = finalPrice({ price, discount_percent: discountPercent })
  if (baseFinal <= 0) {
    redirect(`/courses/${course.id}`)
  }

  const { data: existingEnrollment } = await supabase
    .from('enrollments')
    .select('id')
    .eq('course_id', course.id)
    .eq('learner_id', user.id)
    .maybeSingle()
  if (existingEnrollment) {
    redirect(`/courses/${course.id}`)
  }

  const { count: moduleCount } = await supabase
    .from('modules')
    .select('id', { count: 'exact', head: true })
    .eq('course_id', course.id)

  const thumb = toRenderableImageUrl(course.thumbnail_url ?? null, 400)
  const youSave = price - baseFinal

  return (
    <div className="min-h-screen bg-linear-to-b from-slate-50 to-white">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:py-10">
        <Link
          href={`/courses/${course.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to course
        </Link>

        <div className="mt-4">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Checkout
          </h1>
          <p className="mt-1.5 text-sm text-slate-600">
            Review your order and apply a coupon if you have one.
          </p>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,26rem)] lg:gap-8">
          <section className="space-y-6 order-2 lg:order-1">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-3.5">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Course
                </h2>
              </div>
              <div className="flex flex-col gap-5 p-5 sm:flex-row">
                {thumb ? (
                  <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-xl bg-slate-100 sm:h-32 sm:w-44">
                    <Image
                      src={thumb}
                      alt={course.title}
                      fill
                      className="object-cover"
                      sizes="(min-width: 640px) 176px, 100vw"
                      placeholder="blur"
                      blurDataURL={BLUR_DATA_URL}
                      priority
                    />
                  </div>
                ) : (
                  <div className="aspect-video w-full shrink-0 rounded-xl bg-slate-100 sm:h-32 sm:w-44" />
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-semibold text-slate-900">{course.title}</h3>
                  {course.description ? (
                    <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-slate-600">
                      {course.description}
                    </p>
                  ) : null}

                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500">
                    {moduleCount && moduleCount > 0 ? (
                      <span className="inline-flex items-center gap-1">
                        <BookOpen className="h-3.5 w-3.5" />
                        {moduleCount} {moduleCount === 1 ? 'module' : 'modules'}
                      </span>
                    ) : null}
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      Lifetime access
                    </span>
                  </div>

                  <div className="mt-3 flex items-baseline gap-2">
                    {discountPercent > 0 ? (
                      <>
                        <span className="text-base font-semibold text-slate-900">
                          {formatINR(baseFinal)}
                        </span>
                        <span className="text-sm text-slate-400 line-through">
                          {formatINR(price)}
                        </span>
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                          {discountPercent}% OFF
                        </span>
                      </>
                    ) : (
                      <span className="text-base font-semibold text-slate-900">
                        {formatINR(price)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                  <ShieldCheck className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Secure checkout via Razorpay
                  </h3>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                    Your payment is encrypted end-to-end. Cards, UPI, and net-banking supported.
                    You&apos;ll be enrolled the moment payment confirms.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <CheckoutForm
            courseId={course.id}
            courseTitle={course.title}
            basePaise={Math.round(baseFinal * 100)}
            listPaise={Math.round(price * 100)}
            youSavePaise={Math.round(youSave * 100)}
          />
        </div>
      </div>
    </div>
  )
}
