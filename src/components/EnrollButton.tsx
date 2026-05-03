'use client'

import { useRef, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createClient } from '@/utils/supabase/client'
import { Button } from '@/components/ui/button'

function isAlreadyEnrolledError(error: { code?: string; message?: string }): boolean {
  if (error.code === '23505') return true
  const m = (error.message ?? '').toLowerCase()
  return m.includes('duplicate') || m.includes('unique constraint') || m.includes('already exists')
}

export default function EnrollButton({
  courseId,
  isAuthenticated = true,
}: {
  courseId: string
  isAuthenticated?: boolean
}) {
  const [loading, setLoading] = useState(false)
  const busyRef = useRef(false)
  const queryClient = useQueryClient()
  const router = useRouter()
  const pathname = usePathname()

  const handleEnroll = async () => {
    if (!isAuthenticated) {
      const redirectTo = encodeURIComponent(pathname)
      router.push(`/signup?redirect=${redirectTo}`)
      return
    }

    if (busyRef.current) return
    busyRef.current = true
    setLoading(true)
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        const redirectTo = encodeURIComponent(pathname)
        router.push(`/signup?redirect=${redirectTo}`)
        return
      }

      const { error } = await supabase.from('enrollments').insert({
        course_id: courseId,
        learner_id: user.id,
      })

      if (error && !isAlreadyEnrolledError(error)) {
        toast.error('Could not enroll', { description: error.message })
        return
      }

      await queryClient.invalidateQueries({ queryKey: ['courses', 'catalog'] })
      await router.refresh()
    } finally {
      busyRef.current = false
      setLoading(false)
    }
  }

  return (
    <Button
      type="button"
      onClick={handleEnroll}
      disabled={loading}
      size="lg"
      className="w-full min-h-11 sm:w-auto"
    >
      {loading ? 'Enrolling…' : 'Enroll now'}
    </Button>
  )
}
