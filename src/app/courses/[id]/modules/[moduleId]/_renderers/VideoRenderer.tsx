import VideoModule from '@/components/VideoModule'
import type { LoadedModule } from '../_lib/load-module-page'

export function VideoRenderer({ data }: { data: LoadedModule }) {
  if (!data.contentUrl) return null
  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
        <h2 className="text-base sm:text-lg font-bold text-slate-900">{data.title}</h2>
        <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-blue-700 sm:px-3 sm:py-1 sm:text-xs">
          Video
        </span>
      </div>
      {data.description && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-[13px] whitespace-pre-wrap text-slate-700 sm:px-4 sm:py-3 sm:text-sm">
          {data.description}
        </div>
      )}
      <VideoModule key={data.moduleId} moduleId={data.moduleId} contentUrl={data.contentUrl} />
    </div>
  )
}
