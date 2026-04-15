'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export default function EnrollButton({ courseId }: { courseId: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleEnroll = async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('enrollments').insert({
      course_id: courseId,
      learner_id: user.id,
    })

    setLoading(false)
    router.refresh()
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
