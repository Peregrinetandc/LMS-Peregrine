'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { useEffect, useState } from 'react'

interface NextLessonButtonProps {
  courseId: string
  nextModule: { id: string; title: string; locked: boolean; unlockAt: string | null } | null
  initialCompleted: boolean
  nextDisabledReason: string
}

export default function NextLessonButton({ 
  courseId, 
  nextModule, 
  initialCompleted, 
  nextDisabledReason 
}: NextLessonButtonProps) {
  
  // This state allows us to unlock the button instantly when the video finishes
  const [isCompleted, setIsCompleted] = useState(initialCompleted)

  // This listener catches a custom event we will dispatch from the VideoModule
  useEffect(() => {
    const handleCompletion = () => setIsCompleted(true)
    window.addEventListener('module-completed', handleCompletion)
    return () => window.removeEventListener('module-completed', handleCompletion)
  }, [])

  if (!nextModule) return null

  const canGoNext = isCompleted && !nextModule.locked

  return (
    <div className="space-y-2 pt-2">
      <div className="flex justify-end">
        {canGoNext ? (
          <Link
            href={`/courses/${courseId}/modules/${nextModule.id}`}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            Next lesson
            <ArrowRight className="h-4 w-4" />
          </Link>
        ) : (
          <button
            type="button"
            disabled
            className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg bg-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-600"
            title={nextDisabledReason}
          >
            Next lesson
            <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>
      {!canGoNext && (
        <p className="text-right text-xs text-slate-500">{nextDisabledReason}</p>
      )}
    </div>
  )
}