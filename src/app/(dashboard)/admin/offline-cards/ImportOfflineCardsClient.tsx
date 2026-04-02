'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  normalizeOfflinePublicCode,
  OFFLINE_ID_CODE_RE,
} from '@/lib/offline-id-card'
import { importOfflineIdCards, type ImportOfflineIdCardsResult } from './actions'

type CourseOption = { id: string; title: string; course_code: string }

/** First column only: comma, tab, or simple "quoted" first field. */
function firstColumnFromLine(line: string): string {
  const trimmed = line.trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('"')) {
    let i = 1
    let out = ''
    while (i < trimmed.length) {
      const c = trimmed[i]
      if (c === '"') {
        if (trimmed[i + 1] === '"') {
          out += '"'
          i += 2
          continue
        }
        break
      }
      out += c
      i++
    }
    return out.trim()
  }
  const comma = trimmed.indexOf(',')
  const tab = trimmed.indexOf('\t')
  let sep = -1
  if (comma >= 0 && tab >= 0) sep = Math.min(comma, tab)
  else sep = comma >= 0 ? comma : tab
  if (sep === -1) return trimmed
  return trimmed.slice(0, sep).trim()
}

function parseCodesFromText(text: string): string[] {
  const lines = text.split(/\r?\n/)
  const out: string[] = []
  for (const line of lines) {
    const cell = firstColumnFromLine(line)
    if (cell) out.push(cell)
  }
  return out
}

export default function ImportOfflineCardsClient({ courses }: { courses: CourseOption[] }) {
  const readerDomId = useId().replace(/:/g, '')
  const [pasteText, setPasteText] = useState('')
  const [batchLabel, setBatchLabel] = useState('')
  const [courseId, setCourseId] = useState('')
  const [scannedCodes, setScannedCodes] = useState<string[]>([])
  const [scanning, setScanning] = useState(false)
  const [scanErr, setScanErr] = useState<string | null>(null)
  const scannerRef = useRef<{ stop: () => Promise<void> } | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<ImportOfflineIdCardsResult | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      const s = scannerRef.current
      if (s) {
        void s.stop().catch(() => {})
        scannerRef.current = null
      }
    }
  }, [])

  const mergedCodes = useMemo(() => {
    const fromPaste = parseCodesFromText(pasteText)
    const set = new Set<string>([...fromPaste, ...scannedCodes].map((c) => normalizeOfflinePublicCode(c)))
    return Array.from(set)
  }, [pasteText, scannedCodes])

  const invalidInMerged = useMemo(() => {
    let n = 0
    for (const c of mergedCodes) {
      if (!OFFLINE_ID_CODE_RE.test(c)) n++
    }
    return n
  }, [mergedCodes])

  const stopScanner = useCallback(async () => {
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
  }, [])

  const startScanner = useCallback(async () => {
    setScanErr(null)
    setScanning(true)
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      const elId = `admin-qr-${readerDomId}`
      await new Promise((r) => window.setTimeout(r, 80))
      const qr = new Html5Qrcode(elId, false)
      scannerRef.current = { stop: () => qr.stop() }
      await qr.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        async (decoded) => {
          const norm = normalizeOfflinePublicCode(decoded)
          if (OFFLINE_ID_CODE_RE.test(norm)) {
            setScannedCodes((prev) => (prev.includes(norm) ? prev : [...prev, norm]))
          }
          await stopScanner()
        },
        () => {},
      )
    } catch (e) {
      setScanErr(e instanceof Error ? e.message : 'Could not start camera.')
      setScanning(false)
      scannerRef.current = null
    }
  }, [readerDomId, stopScanner])

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setFileName(file.name)
    const text = await file.text()
    const lines = parseCodesFromText(text)
    if (lines.length === 0) {
      setPasteText((t) => t)
      return
    }
    setPasteText((prev) => {
      const existing = parseCodesFromText(prev)
      const set = new Set([...existing, ...lines].map((c) => normalizeOfflinePublicCode(c)))
      return Array.from(set).join('\n')
    })
  }

  async function handleSubmit() {
    setResult(null)
    const fromPaste = parseCodesFromText(pasteText)
    const normScanned = scannedCodes.map(normalizeOfflinePublicCode)
    const combined = [...fromPaste, ...normScanned]
    if (combined.length === 0) {
      setResult({ ok: false, message: 'Add codes from a CSV file, paste, or scan.' })
      return
    }
    setBusy(true)
    try {
      const res = await importOfflineIdCards({
        codes: combined,
        batchLabel: batchLabel || null,
        courseId: courseId || null,
      })
      setResult(res)
    } catch (err) {
      setResult({
        ok: false,
        message: err instanceof Error ? err.message : 'Import failed.',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-slate-800">Batch options</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">Batch label (optional)</label>
            <input
              value={batchLabel}
              onChange={(e) => setBatchLabel(e.target.value)}
              placeholder="e.g. Spring 2026 print run"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">Pre-scope course (optional)</label>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="">Any course (unscoped)</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} ({c.course_code})
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
        <h2 className="text-sm font-semibold text-slate-800">1. CSV or text file</h2>
        <p className="text-xs text-slate-500">
          Each row: value in the <strong>first column</strong> only (comma or tab separated). Format{' '}
          <code className="text-xs bg-slate-100 px-1 rounded">ID-ABC-XYZ</code>.
        </p>
        <input
          type="file"
          accept=".csv,.txt,text/csv"
          onChange={(e) => void onFileChange(e)}
          className="block text-sm text-slate-600"
        />
        {fileName && <p className="text-xs text-slate-500">Last file: {fileName} (merged into list below)</p>}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
        <h2 className="text-sm font-semibold text-slate-800">2. Paste or edit codes (one per line)</h2>
        <textarea
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          rows={10}
          placeholder={'ID-3V6-Y8H\nID-7K2-W9P'}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono"
        />
        <p className="text-xs text-slate-600">
          Unique codes ready to submit:{' '}
          <strong>{mergedCodes.length}</strong>
          {invalidInMerged > 0 && (
            <span className="text-amber-700"> ({invalidInMerged} invalid format — will be reported)</span>
          )}
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
        <h2 className="text-sm font-semibold text-slate-800">3. Scan QR codes</h2>
        <p className="text-xs text-slate-500">
          Each successful scan appends a valid code. Requires HTTPS or localhost.
        </p>
        <div className="flex flex-wrap gap-2 items-center">
          <button
            type="button"
            onClick={() => (scanning ? void stopScanner() : void startScanner())}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium"
          >
            {scanning ? 'Stop camera' : 'Scan QR'}
          </button>
          {scannedCodes.length > 0 && (
            <button
              type="button"
              onClick={() => setScannedCodes([])}
              className="text-sm text-red-700 hover:underline"
            >
              Clear scanned ({scannedCodes.length})
            </button>
          )}
        </div>
        {scanning && (
          <div
            id={`admin-qr-${readerDomId}`}
            className="w-full max-w-sm rounded-lg overflow-hidden border border-slate-200"
          />
        )}
        {scanErr && <p className="text-sm text-amber-800">{scanErr}</p>}
        {scannedCodes.length > 0 && (
          <ul className="text-xs font-mono flex flex-wrap gap-2 text-slate-700">
            {scannedCodes.map((c) => (
              <li key={c} className="bg-slate-100 px-2 py-0.5 rounded">
                {c}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy || mergedCodes.length === 0}
          onClick={() => void handleSubmit()}
          className="rounded-lg bg-slate-900 text-white px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
        >
          {busy ? 'Importing…' : 'Import to database'}
        </button>
      </div>

      {result && (
        <section
          className={`rounded-xl border p-5 text-sm ${
            result.ok
              ? 'border-emerald-200 bg-emerald-50/80'
              : 'border-red-200 bg-red-50/80'
          }`}
        >
          {!result.ok ? (
            <p className="text-red-800 font-medium">{result.message}</p>
          ) : (
            <div className="space-y-2 text-slate-800">
              <p className="font-semibold text-emerald-900">Import finished</p>
              <ul className="list-none space-y-1">
                <li>
                  <strong>{result.inserted}</strong> new cards inserted
                </li>
                <li>
                  <strong>{result.alreadyInDatabase}</strong> already in database (skipped)
                </li>
                <li>
                  <strong>{result.invalidFormat}</strong> invalid format (not ID-XXX-XXX)
                </li>
                <li>
                  <strong>{result.duplicateInUpload}</strong> duplicate in this upload (skipped)
                </li>
                <li>
                  <strong>{result.validUnique}</strong> unique valid codes in this upload
                </li>
                <li className="text-slate-600 text-xs">
                  Non-empty lines considered: {result.totalSubmitted}
                </li>
              </ul>
              {result.insertErrors.length > 0 && (
                <div className="mt-3">
                  <p className="font-medium text-amber-900 text-xs">Insert errors (sample)</p>
                  <ul className="mt-1 text-xs font-mono text-amber-950 space-y-0.5 max-h-40 overflow-auto">
                    {result.insertErrors.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
