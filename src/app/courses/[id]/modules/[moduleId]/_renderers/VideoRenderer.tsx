import VideoModule from '@/components/VideoModule'
import type { LoadedModule } from '../_lib/load-module-page'

export function VideoRenderer({ data }: { data: LoadedModule }) {
  if (!data.contentUrl) return null
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="lg:text-lg text-base font-bold text-slate-900">{data.title}</h2>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
          Video
        </span>
      </div>
      {data.description && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm whitespace-pre-wrap text-slate-700">
          {data.description}
        </div>
      )}
      <VideoModule key={data.moduleId} moduleId={data.moduleId} contentUrl={data.contentUrl} />
    </div>
  )
}
