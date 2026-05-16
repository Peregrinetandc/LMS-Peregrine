import ExternalResourceLinks from '@/components/ExternalResourceLinks'
import type { LoadedModule } from '../_lib/load-module-page'

export function ExternalResourceRenderer({ data }: { data: LoadedModule }) {
  const { title, description, moduleId, externalLinks } = data

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="lg:text-lg text-base font-bold text-slate-900">{title}</h2>
        <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700">
          External resource
        </span>
      </div>
      {description && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm whitespace-pre-wrap text-slate-700">
          {description}
        </div>
      )}
      {externalLinks.length > 0 ? (
        <ExternalResourceLinks moduleId={moduleId} links={externalLinks} />
      ) : (
        <p className="text-sm text-amber-700">No links have been added for this resource yet.</p>
      )}
    </div>
  )
}
