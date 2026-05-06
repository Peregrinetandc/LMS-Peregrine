import { AppCard } from '@/components/ui/primitives'
import type { MetricCard } from '../_types'

export default function MetricCardGrid({ metrics }: { metrics: MetricCard[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {metrics.map((m) => (
        <AppCard
          key={m.label}
          className="relative overflow-hidden p-5 flex flex-row justify-between gap-4 rounded-2xl"
        >
          {/* Background icon */}
          <div className="pointer-events-none absolute opacity-30 -right-4 -bottom-4 text-slate-200 [&>svg]:w-20 [&>svg]:h-20">
            {m.icon}
          </div>

          <div className="relative z-10 min-w-0 flex flex-col justify-between gap-0.5">
            <p className="text-xs font-bold text-slate-500">{m.label}</p>
            <p className="text-4xl font-bold text-slate-900 tracking-tight">{m.value}</p>
            {m.hint ? (
              <p className="text-[11px] text-slate-400 leading-snug">{m.hint}</p>
            ) : null}
          </div>
        </AppCard>
      ))}
    </div>
  )
}
