'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { lookupLearnerByIdCard, type LookupLearnerByIdCardResult } from './actions'
import { normalizeOfflinePublicCode, OFFLINE_ID_CODE_RE } from '@/lib/offline-id-card'
import { Camera, ScanLine, XCircle } from 'lucide-react'

export default function LearnerIdLookupClient() {
  const readerDomId = useId().replace(/:/g, '')
  const [codeInput, setCodeInput] = useState('')
  const [result, setResult] = useState<LookupLearnerByIdCardResult | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanErr, setScanErr] = useState<string | null>(null)
  const scannerRef = useRef<{ stop: () => Promise<void> } | null>(null)

  const normalizedCode = useMemo(() => normalizeOfflinePublicCode(codeInput), [codeInput])

  useEffect(() => {
    return () => {
      const s = scannerRef.current
      if (s) {
        void s.stop().catch(() => {})
        scannerRef.current = null
      }
    }
  }, [])

  async function stopScanner() {
    const s = scannerRef.current
    if (s) {
      try {
        await s.stop()
      } catch {
        /* ignore */
      }
      scannerRef.current = null
    }
    setScanning(false)
  }

  async function startScanner() {
    setScanErr(null)
    setScanning(true)
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      const elId = `qr-${readerDomId}`
      await new Promise((r) => window.setTimeout(r, 80))
      const qr = new Html5Qrcode(elId, false)
      scannerRef.current = { stop: () => qr.stop() }
      await qr.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        async (decoded) => {
          const norm = normalizeOfflinePublicCode(decoded)
          setCodeInput(norm)
          await stopScanner()
          void runLookup(norm)
        },
        () => {},
      )
    } catch (e) {
      setScanErr(e instanceof Error ? e.message : 'Could not start camera (use HTTPS or localhost).')
      setScanning(false)
      scannerRef.current = null
    }
  }

  const runLookup = useCallback(async (codeOverride?: string) => {
    const norm = codeOverride ?? normalizedCode
    setErr(null)
    setResult(null)
    if (!OFFLINE_ID_CODE_RE.test(norm)) {
      setErr('Enter a code like ID-ABC-XYZ (scan or type).')
      return
    }
    setBusy(true)
    try {
      const res = await lookupLearnerByIdCard(norm)
      if (!res.ok) {
        setErr(res.message)
        return
      }
      setResult(res)
    } catch {
      setErr('Could not look up this code. Check your connection.')
    } finally {
      setBusy(false)
    }
  }, [normalizedCode])

  function courseLine(c: { title: string; course_code: string }): string {
    const t = c.title?.trim()
    const code = c.course_code?.trim()
    if (t && code) return `${t} (${code})`
    return t || code || 'Course'
  }

  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">ID card code</h2>
        <p className="text-xs text-slate-600">
          Scan a printed code or type it, then look up the learner (read-only).
        </p>
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[180px] space-y-1">
            <label className="text-xs font-medium text-slate-600">Code</label>
            <input
              value={codeInput}
              onChange={(e) => {
                setCodeInput(e.target.value.toUpperCase())
                setResult(null)
                setErr(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void runLookup()
                }
              }}
              placeholder="ID-ABC-XYZ"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono tracking-wide"
            />
          </div>
          <button
            type="button"
            title={scanning ? 'Stop camera' : 'Scan with camera'}
            onClick={() => (scanning ? void stopScanner() : void startScanner())}
            className="rounded-lg border border-slate-300 px-4 py-2 hover:bg-slate-50 flex items-center gap-1.5 text-sm"
          >
            {scanning ? <XCircle className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
          </button>
        </div>
        {scanning && (
          <div
            id={`qr-${readerDomId}`}
            className="w-full max-w-sm rounded-lg overflow-hidden border border-slate-200 bg-black/5"
          />
        )}
        {scanErr && <p className="text-sm text-amber-800">{scanErr}</p>}
        <button
          type="button"
          disabled={busy || !normalizedCode}
          onClick={() => void runLookup()}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-800 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          <ScanLine className="w-4 h-4" />
          Look up learner
        </button>
      </section>

      {err && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{err}</div>
      )}

      {result?.ok && (
        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-800">Result</h2>
          <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-3 text-sm space-y-2">
            <p>
              <span className="font-medium text-slate-700">Code:</span>{' '}
              <span className="font-mono">{result.publicCode}</span>
            </p>
            <p>
              <span className="font-medium text-slate-700">Status:</span>{' '}
              {!result.bound ? (
                <span className="text-amber-900">Not bound — no learner on this card yet</span>
              ) : (
                <span className="text-emerald-800">Bound to a learner</span>
              )}
            </p>
            {!result.bound ? (
              <p className="text-amber-900 pt-1">
                Bind this card on the <span className="font-medium">Bind ID cards</span> page when ready.
              </p>
            ) : (
              <div className="pt-1 space-y-2 border-t border-slate-200 mt-2 pt-2">
                <p className="font-medium text-slate-800">Learner</p>
                <p>
                  <span className="text-slate-600">Name:</span>{' '}
                  <span className="text-slate-900">{result.learner.full_name?.trim() || '—'}</span>
                </p>
                <p>
                  <span className="text-slate-600">Email:</span>{' '}
                  <span className="text-slate-900">{result.learner.email?.trim() || '—'}</span>
                </p>
                <p className="text-xs text-slate-500 font-mono">ID: {result.learner.id}</p>
                <div className="pt-2">
                  <p className="font-medium text-slate-700 text-sm">Courses this learner is enrolled in</p>
                  {result.enrolledCourses.length === 0 ? (
                    <p className="text-xs text-slate-600 pt-1">No enrollments visible with your access.</p>
                  ) : (
                    <ul className="list-disc pl-5 mt-1 space-y-0.5 text-slate-700">
                      {result.enrolledCourses.map((c) => (
                        <li key={c.id}>{courseLine(c)}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
