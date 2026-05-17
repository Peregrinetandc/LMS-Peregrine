'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createClient } from '@/utils/supabase/client'
import {
  MAX_FILE_BYTES,
  MAX_FILES_PER_SUBMISSION,
  isAllowedAssignmentMime,
} from '@/lib/assignment-files'
import {
  Upload,
  CheckCircle2,
  XCircle,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  Film,
  Loader2,
  Send,
  Undo2,
  Trash2,
  AlertTriangle,
  Clock3,
  ExternalLink,
} from 'lucide-react'
import { queryKeys } from '@/lib/query/query-keys'
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog'
import ExpandableText from '@/components/ExpandableText'
import {
  fetchWithRetry,
  getFetchErrorMessage,
  postFileWithRetry,
} from '@/lib/network-retry'

type ApiSubmission = {
  id: string
  isTurnedIn: boolean
  turnedInAt: string | null
  score: number | null
  feedback: string | null
  gradedAt: string | null
  isPassed: boolean | null
  maxScore: number | null
  passingScore: number | null
} | null

const IS_ANDROID = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)
const ANDROID_WARN_BYTES = 50 * 1024 * 1024 // 50 MB
const UPLOAD_ISSUE_TOAST_MS = 18_000
const UPLOAD_PROGRESS_MAX_IN_FLIGHT = 99

function fileExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase()
}

function iconForFileName(name: string) {
  const ext = fileExtension(name)
  if (['pdf'].includes(ext)) return { Icon: FileText, color: 'text-red-600', bg: 'bg-red-50' }
  if (['doc', 'docx'].includes(ext)) return { Icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' }
  if (['xls', 'xlsx', 'csv'].includes(ext))
    return { Icon: FileSpreadsheet, color: 'text-emerald-600', bg: 'bg-emerald-50' }
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext))
    return { Icon: ImageIcon, color: 'text-purple-600', bg: 'bg-purple-50' }
  if (['mp4', 'mov', 'webm'].includes(ext))
    return { Icon: Film, color: 'text-indigo-600', bg: 'bg-indigo-50' }
  return { Icon: FileText, color: 'text-slate-600', bg: 'bg-slate-100' }
}

function relativeTime(from: Date, to: Date): string {
  const diffMs = to.getTime() - from.getTime()
  const abs = Math.abs(diffMs)
  const min = Math.round(abs / 60_000)
  const hr = Math.round(abs / 3_600_000)
  const day = Math.round(abs / 86_400_000)
  const past = diffMs >= 0
  const phrase = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`
  let core: string
  if (min < 60) core = phrase(Math.max(1, min), 'minute')
  else if (hr < 24) core = phrase(hr, 'hour')
  else core = phrase(day, 'day')
  return past ? `${core} ago` : `in ${core}`
}

export default function AssignmentUpload({
  assignmentId,
  deadlineAt,
}: {
  assignmentId: string
  deadlineAt?: string | null
}) {
  const queryClient = useQueryClient()
  const [uploading, setUploading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [unsubmitConfirmOpen, setUnsubmitConfirmOpen] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [uploadUi, setUploadUi] = useState<{
    fileLabel: string
    fileIndex: number
    fileTotal: number
    overallPercent: number
  } | null>(null)

  const reportIssue = useCallback((title: string, message: string) => {
    toast.error(title, { description: message, duration: UPLOAD_ISSUE_TOAST_MS })
  }, [])

  const loadSubmission = useCallback(async () => {
    const res = await fetchWithRetry(
      `/api/assignments/submission?assignmentId=${encodeURIComponent(assignmentId)}`,
    )
    const data = (await res.json().catch(() => ({}))) as {
      submission: ApiSubmission
      files: { id: string; file_url: string; original_name: string }[]
      error?: string
    }
    if (!res.ok) {
      throw new Error(
        data.error ?? `Could not load submission (HTTP ${res.status}). Check connection or try again.`,
      )
    }
    return {
      submission: data.submission,
      files: (data.files ?? []).map((f) => ({
        id: f.id,
        file_url: f.file_url,
        original_name: f.original_name,
      })),
    }
  }, [assignmentId])

  const submissionQuery = useQuery({
    queryKey: queryKeys.assignmentSubmission({ assignmentId }),
    queryFn: loadSubmission,
    staleTime: 0,
    refetchOnMount: 'always',
  })

  useEffect(() => {
    if (!submissionQuery.error) return
    const msg =
      submissionQuery.error instanceof Error
        ? submissionQuery.error.message
        : 'Network error loading submission. Try Wi-Fi or disable data saver.'
    reportIssue('Assignment submission', msg)
  }, [reportIssue, submissionQuery.error])

  const submission = submissionQuery.data?.submission ?? null
  const files = submissionQuery.data?.files ?? []

  const graded = !!submission?.gradedAt
  const turnedIn = !!submission?.isTurnedIn
  const isPassed = submission?.isPassed ?? false
  const isLocked = graded && isPassed
  const canEdit = !isLocked && !turnedIn
  const canUnsubmit = !isLocked && turnedIn
  const statusLabel = graded ? 'Graded' : turnedIn ? 'Turned in' : 'Draft'

  const deadlineDate = useMemo(() => (deadlineAt ? new Date(deadlineAt) : null), [deadlineAt])
  const turnedInDate = useMemo(
    () => (submission?.turnedInAt ? new Date(submission.turnedInAt) : null),
    [submission?.turnedInAt],
  )
  const now = useMemo(() => new Date(), [submissionQuery.dataUpdatedAt])
  const isOverdue = !!(deadlineDate && !turnedIn && now > deadlineDate)
  const isLate = !!(deadlineDate && turnedInDate && turnedInDate > deadlineDate)

  const timingLine = (() => {
    if (turnedInDate) {
      return `Submitted ${relativeTime(turnedInDate, now)}${
        isLate ? ' — past the deadline' : ''
      }`
    }
    if (deadlineDate) {
      const rel = relativeTime(deadlineDate, now)
      return now > deadlineDate ? `Overdue ${rel}` : `Due ${rel}`
    }
    return null
  })()

  async function handleAddFiles(picked: File[]) {
    if (!picked.length) return
    setUploading(true)
    try {
      const supabase = createClient()
      const { data, error: authError } = await supabase.auth.getUser()
      if (authError || !data?.user) {
        reportIssue('Assignment upload', 'You must be signed in.')
        return
      }
      if (files.length + picked.length > MAX_FILES_PER_SUBMISSION) {
        reportIssue('Assignment upload', `You can attach up to ${MAX_FILES_PER_SUBMISSION} files.`)
        return
      }
      for (const file of picked) {
        if (file.size > MAX_FILE_BYTES) {
          reportIssue(
            'Assignment upload',
            `"${file.name}" is too large (max ${Math.floor(MAX_FILE_BYTES / (1024 * 1024))} MB).`,
          )
          return
        }
        if (!isAllowedAssignmentMime(file.type, file.name)) {
          reportIssue(
            'Assignment upload',
            `"${file.name}" is not an allowed type (PDF, Word, Excel, CSV, images, or MP4).` +
              (!file.type
                ? ' Your device did not report a file type — try picking from the Files app.'
                : ` (detected: ${file.type})`),
          )
          return
        }
        if (IS_ANDROID && file.size > ANDROID_WARN_BYTES) {
          reportIssue(
            'File too large for mobile',
            `"${file.name}" is ${Math.round(file.size / (1024 * 1024))} MB. Please keep files under 50 MB on mobile, or upload from a desktop browser.`,
          )
          return
        }
      }

      const n = picked.length
      for (let i = 0; i < n; i++) {
        const file = picked[i]
        const url = `/api/assignments/upload?assignmentId=${encodeURIComponent(assignmentId)}&fileName=${encodeURIComponent(file.name)}&mimeType=${encodeURIComponent(file.type || '')}`
        const headers = {
          'Content-Type': file.type || 'application/octet-stream',
          'X-File-Name': encodeURIComponent(file.name),
        }
        setUploadUi({
          fileLabel: file.name,
          fileIndex: i + 1,
          fileTotal: n,
          overallPercent: Math.round((i / n) * UPLOAD_PROGRESS_MAX_IN_FLIGHT),
        })
        const res = await postFileWithRetry(
          url,
          file,
          headers,
          (pe) => {
            const rawPct =
              pe.percent != null
                ? pe.percent
                : file.size > 0
                  ? Math.round((pe.loaded / file.size) * 100)
                  : 0
            const filePct = Math.min(UPLOAD_PROGRESS_MAX_IN_FLIGHT, rawPct)
            const base = (i / n) * UPLOAD_PROGRESS_MAX_IN_FLIGHT
            const span = (1 / n) * UPLOAD_PROGRESS_MAX_IN_FLIGHT
            const overall = Math.min(
              UPLOAD_PROGRESS_MAX_IN_FLIGHT,
              Math.round(base + (filePct / 100) * span),
            )
            setUploadUi({
              fileLabel: file.name,
              fileIndex: i + 1,
              fileTotal: n,
              overallPercent: overall,
            })
          },
          { retries: 4, baseDelayMs: 700 },
        )

        let payload: { error?: string } = {}
        try {
          payload = JSON.parse(res.bodyText || '{}') as { error?: string }
        } catch {
          payload = {}
        }
        if (!res.ok) {
          reportIssue(
            'Assignment upload',
            `${file.name}: ${payload.error ?? `Upload failed (HTTP ${res.status})`}`,
          )
          return
        }
      }

      const lastFile = picked[n - 1]
      setUploadUi({
        fileLabel: lastFile.name,
        fileIndex: n,
        fileTotal: n,
        overallPercent: 100,
      })

      await queryClient.invalidateQueries({
        queryKey: queryKeys.assignmentSubmission({ assignmentId }),
      })
      await new Promise((r) => setTimeout(r, 450))
    } catch (e) {
      reportIssue('Assignment upload', getFetchErrorMessage(e))
    } finally {
      setUploading(false)
      setUploadUi(null)
    }
  }

  async function removeFile(fileId: string) {
    setActionLoading(true)
    try {
      const q =
        fileId === 'legacy' ? `?assignmentId=${encodeURIComponent(assignmentId)}` : ''
      const res = await fetchWithRetry(
        `/api/assignments/files/${encodeURIComponent(fileId)}${q}`,
        { method: 'DELETE' },
      )
      const payload = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        reportIssue('Assignment file', payload.error ?? 'Could not remove file.')
        return
      }
      await queryClient.invalidateQueries({
        queryKey: queryKeys.assignmentSubmission({ assignmentId }),
      })
    } catch (e) {
      reportIssue(
        'Assignment file',
        e instanceof Error ? e.message : 'Network error while removing file.',
      )
    } finally {
      setActionLoading(false)
    }
  }

  async function turnIn() {
    setActionLoading(true)
    try {
      const res = await fetchWithRetry('/api/assignments/turn-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignmentId }),
      })
      const payload = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        reportIssue('Turn in', payload.error ?? `Could not turn in (HTTP ${res.status}).`)
        return
      }
      await queryClient.invalidateQueries({
        queryKey: queryKeys.assignmentSubmission({ assignmentId }),
      })
    } catch (e) {
      reportIssue('Turn in', e instanceof Error ? e.message : 'Network error while turning in.')
    } finally {
      setActionLoading(false)
    }
  }

  async function unsubmit() {
    setUnsubmitConfirmOpen(false)
    setActionLoading(true)
    try {
      const res = await fetchWithRetry('/api/assignments/unsubmit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignmentId }),
      })
      const payload = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        reportIssue('Unsubmit', payload.error ?? `Could not unsubmit (HTTP ${res.status}).`)
        return
      }
      await queryClient.invalidateQueries({
        queryKey: queryKeys.assignmentSubmission({ assignmentId }),
      })
    } catch (e) {
      reportIssue('Unsubmit', e instanceof Error ? e.message : 'Network error while unsubmitting.')
    } finally {
      setActionLoading(false)
    }
  }

  if (submissionQuery.isLoading) {
    return (
      <div className="flex items-center gap-2 text-slate-500 py-8 justify-center">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading…
      </div>
    )
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* --- Submission status card --- */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 sm:px-4 sm:py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[13px] sm:text-sm font-semibold text-slate-800">Submission status</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide sm:px-3 sm:py-1 sm:text-xs ${
                graded
                  ? 'bg-emerald-100 text-emerald-700'
                  : turnedIn
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-slate-200 text-slate-700'
              }`}
            >
              {statusLabel}
            </span>
            {isOverdue && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-red-800 sm:px-3 sm:py-1 sm:text-xs">
                <AlertTriangle className="h-3 w-3" />
                Overdue
              </span>
            )}
            {isLate && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-800 sm:px-3 sm:py-1 sm:text-xs">
                <Clock3 className="h-3 w-3" />
                Late
              </span>
            )}
          </div>
        </div>
        {timingLine && (
          <p className="mt-1.5 text-[12px] sm:text-xs text-slate-600">{timingLine}</p>
        )}
        {!turnedIn && !graded && !timingLine && (
          <p className="mt-1.5 text-[12px] sm:text-xs text-slate-600">
            Add your files and click <span className="font-semibold">Turn in</span> when ready.
          </p>
        )}
      </div>

      {/* --- Graded card --- */}
      {graded && submission && (
        <div
          className={`rounded-lg border ${
            submission.isPassed ? 'border-emerald-200 bg-emerald-50/60' : 'border-red-200 bg-red-50/70'
          } p-3 sm:p-4 space-y-3`}
        >
          <div className="flex items-center justify-between gap-3">
            <div
              className={`inline-flex items-center gap-1.5 text-sm sm:text-base font-semibold ${
                submission.isPassed ? 'text-emerald-800' : 'text-red-800'
              }`}
            >
              {submission.isPassed ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <XCircle className="h-5 w-5" />
              )}
              {submission.isPassed ? 'Graded — Passed' : 'Graded — Not passed'}
            </div>
            <div className="text-right">
              <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Score
              </p>
              <p
                className={`text-xl sm:text-2xl font-bold tabular-nums ${
                  submission.isPassed ? 'text-emerald-700' : 'text-red-700'
                }`}
              >
                {submission.score ?? '—'}
                {submission.maxScore != null && (
                  <span className="text-sm font-medium text-slate-400">
                    {' '}
                    / {submission.maxScore}
                  </span>
                )}
              </p>
            </div>
          </div>
          {submission.feedback && (
            <div className="rounded-md border border-white/60 bg-white/70 px-3 py-2.5 sm:px-3 sm:py-3">
              <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Instructor feedback
              </p>
              <ExpandableText
                text={submission.feedback}
                className="mt-1 text-[13px] sm:text-sm text-slate-800"
                clampLines={4}
              />
            </div>
          )}
        </div>
      )}

      {/* --- Your work / file list --- */}
      <div className="space-y-2">
        <p className="text-[13px] sm:text-sm font-medium text-slate-700">Your work</p>
        {files.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50/60 px-4 py-6 text-center">
            <Upload className="h-6 w-6 text-slate-300" />
            <p className="mt-2 text-[13px] sm:text-sm font-medium text-slate-600">
              No files attached yet
            </p>
            <p className="mt-0.5 text-[11px] sm:text-xs text-slate-400">
              Pick or drop files below to attach your work.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {files.map((f) => {
              const { Icon, color, bg } = iconForFileName(f.original_name)
              return (
                <li
                  key={f.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm sm:p-3"
                >
                  <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
                    <div className={`shrink-0 rounded-lg p-2 ${bg} ${color}`}>
                      <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] sm:text-sm font-medium text-slate-900">
                        {f.original_name}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {fileExtension(f.original_name).toUpperCase() || 'File'}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <a
                      href={f.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] sm:text-xs font-medium text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                    >
                      Open
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => void removeFile(f.id)}
                        disabled={actionLoading || uploading}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        title="Remove"
                        aria-label={`Remove ${f.original_name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* --- Dropzone (with drag & drop) --- */}
      {canEdit && (
        <label
          onDragEnter={(e) => {
            e.preventDefault()
            e.stopPropagation()
            if (!uploading) setIsDragOver(true)
          }}
          onDragOver={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
          onDragLeave={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setIsDragOver(false)
          }}
          onDrop={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setIsDragOver(false)
            if (uploading) return
            const dropped = e.dataTransfer?.files ? Array.from(e.dataTransfer.files) : []
            if (dropped.length) void handleAddFiles(dropped)
          }}
          className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-4 transition-all duration-150 sm:p-6 ${
            uploading
              ? 'pointer-events-none border-blue-200 bg-blue-50/40'
              : isDragOver
                ? 'scale-[1.01] border-solid border-blue-500 bg-blue-100 ring-4 ring-blue-200/60 cursor-copy'
                : 'border-slate-300 cursor-pointer hover:border-blue-400 hover:bg-blue-50/50'
          }`}
        >
          {uploading && uploadUi ? (
            <>
              <p className="mb-2 text-[13px] sm:text-sm font-semibold text-slate-800">Uploading…</p>
              <div
                className="mb-2 w-full max-w-xs"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={uploadUi.overallPercent}
                aria-label={`Upload progress ${uploadUi.overallPercent} percent`}
              >
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-blue-600 transition-[width] duration-200 ease-out"
                    style={{ width: `${uploadUi.overallPercent}%` }}
                  />
                </div>
              </div>
              <p className="text-base sm:text-lg font-bold tabular-nums text-blue-700">
                {uploadUi.overallPercent}%
              </p>
              <p
                className="mt-1 max-w-full truncate px-2 text-center text-[11px] sm:text-xs text-slate-500"
                title={`${uploadUi.fileLabel} — file ${uploadUi.fileIndex} of ${uploadUi.fileTotal}`}
              >
                {uploadUi.fileLabel}
                <span className="text-slate-400">
                  {' '}
                  · File {uploadUi.fileIndex} of {uploadUi.fileTotal}
                </span>
              </p>
            </>
          ) : (
            <>
              <Upload
                className={`mb-1.5 transition-all sm:mb-2 ${
                  isDragOver ? 'h-9 w-9 text-blue-600 sm:h-10 sm:w-10' : 'h-6 w-6 text-slate-300 sm:h-8 sm:w-8'
                }`}
              />
              <p
                className={`text-center font-medium ${
                  isDragOver
                    ? 'text-sm sm:text-base text-blue-700'
                    : 'text-[13px] sm:text-sm text-slate-600'
                }`}
              >
                {isDragOver ? (
                  'Drop files to upload'
                ) : (
                  <>
                    <span className="pointer-fine:hidden">Tap to attach files</span>
                    <span className="hidden pointer-fine:inline">
                      Drag and drop files here, or click to browse
                    </span>
                  </>
                )}
              </p>
              <p className="mt-1 text-center text-[11px] sm:text-xs text-slate-400">
                PDF, Word, Excel, CSV, images, MP4 · Up to {MAX_FILES_PER_SUBMISSION} files ·{' '}
                {Math.floor(MAX_FILE_BYTES / (1024 * 1024))} MB each
              </p>
            </>
          )}
          <input
            type="file"
            multiple
            className="sr-only"
            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.gif,.webp,.csv,.xlsx,.xls,.mp4,application/pdf,image/*,video/mp4,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            disabled={uploading || files.length >= MAX_FILES_PER_SUBMISSION}
            onChange={(e) => {
              const snapshot = e.target.files ? Array.from(e.target.files) : []
              e.target.value = ''
              void handleAddFiles(snapshot)
            }}
          />
        </label>
      )}

      {/* --- Actions --- */}
      {!isLocked && (
        <div className="space-y-2 pt-1 sm:pt-2">
          {canUnsubmit && (
            <p className="text-[12px] sm:text-xs text-slate-600">
              Your work is turned in. Unsubmit if you need to change or add files.
            </p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
            {canEdit && (
              <button
                type="button"
                onClick={() => void turnIn()}
                disabled={actionLoading || uploading || files.length === 0}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-blue-700 disabled:opacity-50 sm:px-5 sm:py-2.5"
              >
                {actionLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Turn in
              </button>
            )}
            {canUnsubmit && (
              <button
                type="button"
                onClick={() => setUnsubmitConfirmOpen(true)}
                disabled={actionLoading}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-800 transition hover:bg-amber-50 disabled:opacity-50 sm:px-5 sm:py-2.5"
              >
                <Undo2 className="h-4 w-4" />
                Unsubmit
              </button>
            )}
          </div>
        </div>
      )}

      <ConfirmationDialog
        open={unsubmitConfirmOpen}
        title="Unsubmit your work?"
        description="You'll need to turn it in again before the deadline to be graded on time. Your attached files are kept."
        confirmLabel="Unsubmit"
        confirmVariant="danger"
        busy={actionLoading}
        onCancel={() => setUnsubmitConfirmOpen(false)}
        onConfirm={() => void unsubmit()}
      />
    </div>
  )
}
