'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'

interface ExpandableTextProps {
  text: string
  className?: string
  clampLines?: number
}

export default function ExpandableText({
  text,
  className = '',
  clampLines = 4,
}: ExpandableTextProps) {
  const [expanded, setExpanded] = useState(false)
  const [wasOverflowing, setWasOverflowing] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (expanded) return
    const el = ref.current
    if (!el) return
    const check = () => {
      const overflowing = el.scrollHeight > el.clientHeight + 1
      if (overflowing) setWasOverflowing(true)
    }
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
  }, [text, clampLines, expanded])

  return (
    <div className="space-y-1.5">
      <div
        ref={ref}
        className={`prose-quick ${className}`}
        style={
          expanded
            ? undefined
            : {
                display: '-webkit-box',
                WebkitLineClamp: clampLines,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }
        }
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkBreaks]}
          components={{
            a: ({ ...props }) => (
              <a {...props} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-700" />
            ),
            ul: ({ ...props }) => <ul {...props} className="my-1 list-disc pl-5 space-y-0.5" />,
            ol: ({ ...props }) => <ol {...props} className="my-1 list-decimal pl-5 space-y-0.5" />,
            p: ({ ...props }) => <p {...props} className="my-2 first:mt-0 last:mb-0" />,
            code: ({ ...props }) => (
              <code {...props} className="rounded bg-slate-100 px-1 py-0.5 text-[0.85em] font-mono" />
            ),
            pre: ({ ...props }) => (
              <pre {...props} className="my-2 overflow-x-auto rounded-md bg-slate-100 p-2 text-[0.85em] font-mono" />
            ),
            h1: ({ ...props }) => <h1 {...props} className="mb-1 mt-2 text-base font-semibold" />,
            h2: ({ ...props }) => <h2 {...props} className="mb-1 mt-2 text-sm font-semibold" />,
            h3: ({ ...props }) => <h3 {...props} className="mb-1 mt-2 text-sm font-semibold" />,
            blockquote: ({ ...props }) => (
              <blockquote {...props} className="my-1 border-l-2 border-slate-300 pl-3 text-slate-600 italic" />
            ),
            strong: ({ ...props }) => <strong {...props} className="font-semibold" />,
          }}
        >
          {text}
        </ReactMarkdown>
      </div>
      {wasOverflowing && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
        >
          {expanded ? (
            <>
              Show less <ChevronUp className="h-3.5 w-3.5" />
            </>
          ) : (
            <>
              Read more <ChevronDown className="h-3.5 w-3.5" />
            </>
          )}
        </button>
      )}
    </div>
  )
}
