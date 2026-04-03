'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { AppButton } from '@/components/ui/primitives'

type Props = {
  force?: boolean
  label?: string
}

export function RunSheetSyncButton({ force = false, label }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const defaultLabel = force ? 'Re-sync all rows (force)' : 'Run sync now'

  async function run() {
    setLoading(true)
    setMessage(null)
    try {
      const qs = force ? '?force=1' : ''
      const res = await fetch(`/api/integrations/google-sheets/sync${qs}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(force ? { force: true } : {}),
      })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        status?: string
        rowsTotal?: number
        rowsOk?: number
        rowsSkipped?: number
      }
      if (!res.ok) {
        setMessage({ type: 'err', text: data.error || `Request failed (${res.status})` })
      } else {
        setMessage({
          type: 'ok',
          text: `${data.status}: processed ${data.rowsOk ?? 0}/${data.rowsTotal ?? 0}, skipped ${data.rowsSkipped ?? 0}`,
        })
        router.refresh()
      }
    } catch (e) {
      setMessage({ type: 'err', text: e instanceof Error ? e.message : String(e) })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <AppButton type="button" variant={force ? 'secondary' : 'primary'} disabled={loading} onClick={run}>
        <RefreshCw className={`h-4 w-4 shrink-0 ${loading ? 'animate-spin' : ''}`} />
        {loading ? 'Syncing…' : (label ?? defaultLabel)}
      </AppButton>
      {message ? (
        <p className={`max-w-xs text-xs sm:max-w-md ${message.type === 'err' ? 'text-red-600' : 'text-emerald-700'}`}>
          {message.text}
        </p>
      ) : null}
    </div>
  )
}
