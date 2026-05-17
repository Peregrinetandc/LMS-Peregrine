'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'

interface ExpandableTextProps {
  text: string
  className?: string
  clampLines?: number
}

/**
 * Normalize line endings and preserve runs of blank lines.
 *
 * Markdown collapses any run of blank lines into a single paragraph break.
 * For each extra blank line beyond the first, inject an invisible paragraph
 * (a non-breaking space) so the visual gap matches what the author typed.
 */
function preserveAuthorSpacing(input: string): string {
  const normalized = input.replace(/\r\n?/g, '\n')
  return normalized.replace(/\n{3,}/g, (match) => {
    const extras = match.length - 2
    return '\n\n' + ' \n\n'.repeat(extras)
  })
}

export default function ExpandableText({
  text,
  className = '',
  clampLines = 4,
}: ExpandableTextProps) {
  const [expanded, setExpanded] = useState(false)
  const [wasOverflowing, setWasOverflowing] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const prepared = useMemo(() => preserveAuthorSpacing(text), [text])

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
            a: ({ node, ...props }) => (
              <a {...props} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-700" />
            ),
            ul: ({ node, ...props }) => <ul {...props} dir="auto" className="my-2 list-disc ps-5 space-y-1" />,
            ol: ({ node, ...props }) => <ol {...props} dir="auto" className="my-2 list-decimal ps-5 space-y-1" />,
            li: ({ node, ...props }) => <li {...props} dir="auto" />,
            p: ({ node, ...props }) => <p {...props} dir="auto" className="my-3 first:mt-0 last:mb-0 leading-relaxed" />,
            code: ({ node, ...props }) => (
              <code {...props} className="rounded bg-slate-100 px-1 py-0.5 text-[0.85em] font-mono" />
            ),
            pre: ({ node, ...props }) => (
              <pre {...props} dir="ltr" className="my-2 overflow-x-auto rounded-md bg-slate-100 p-2 text-[0.85em] font-mono" />
            ),
            h1: ({ node, ...props }) => <h1 {...props} dir="auto" className="mb-2 mt-4 text-base font-semibold first:mt-0" />,
            h2: ({ node, ...props }) => <h2 {...props} dir="auto" className="mb-2 mt-4 text-sm font-semibold first:mt-0" />,
            h3: ({ node, ...props }) => <h3 {...props} dir="auto" className="mb-2 mt-4 text-sm font-semibold first:mt-0" />,
            blockquote: ({ node, ...props }) => (
              <blockquote {...props} dir="auto" className="my-2 border-s-2 border-slate-300 ps-3 text-slate-600 italic" />
            ),
            strong: ({ node, ...props }) => <strong {...props} className="font-semibold" />,
            em: ({ node, ...props }) => <em {...props} className="italic" />,
            hr: ({ node, ...props }) => <hr {...props} className="my-4 border-t border-slate-200" />,
            table: ({ node, ...props }) => (
              <div className="my-2 overflow-x-auto">
                <table {...props} className="min-w-full border-collapse text-[0.95em]" />
              </div>
            ),
            th: ({ node, ...props }) => <th {...props} dir="auto" className="border border-slate-200 bg-slate-50 px-2 py-1 text-start font-semibold" />,
            td: ({ node, ...props }) => <td {...props} dir="auto" className="border border-slate-200 px-2 py-1" />,
          }}
        >
          {prepared}
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
