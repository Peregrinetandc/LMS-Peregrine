'use client'

import { useCallback, useEffect, useState } from 'react'
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
  FileText,
  Loader2,
  Send,
  Undo2,
  Trash2,
} from 'lucide-react'
import { queryKeys } from '@/lib/query/query-keys'
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

/** Long duration so small-phone / WebView users can read the real server or network message. */
const UPLOAD_ISSUE_TOAST_MS = 18_000

/** Bar stays below 100% until the API returns OK (server has finished saving to Google Drive). */
const UPLOAD_PROGRESS_MAX_IN_FLIGHT = 99

export default function AssignmentUpload({ assignmentId }: { assignmentId: string }) {
  const queryClient = useQueryClient()
  const [uploading, setUploading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  /** Shown while files POST to the server (bytes sent — not server/Drive processing). */
  const [uploadUi, setUploadUi] = useState<{
    fileLabel: string
    fileIndex: number
    fileTotal: number
    overallPercent: number
  } | null>(null)

  /** Toast only — survives scroll and stays obvious on small screens / WebView. */
  const reportIssue = useCallback((title: string, message: string) => {
    toast.error(title, {
      description: message,
      duration: UPLOAD_ISSUE_TOAST_MS,
    })
  }, [])

  const loadSubmission = useCallback(async () => {
    const res = await fetchWithRetry(
      `/api/assignments/submission?assignmentId=${encodeURIComponent(assignmentId)}`,
    )
    const data = (await res.json().catch(() => ({}))) as {
      submission: ApiSubmission
      files: {
        id: string
        file_url: string
        original_name: string
      }[]
      error?: string
    }
    if (!res.ok) {
      throw new Error(
        data.error ??
          `Could not load submission (HTTP ${res.status}). Check connection or try again.`,
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

  const isPassed = submission?.isPassed ?? false;
  const isLocked = graded && isPassed;

  const canEdit = !isLocked && !turnedIn;
  const canUnsubmit = !isLocked && turnedIn;
  const statusLabel = graded ? 'Graded' : turnedIn ? 'Turned in' : 'Draft'

  /** Pass a snapshot `Array.from(input.files)` so the list survives input reset after await. */
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
          reportIssue('Assignment upload', `"${file.name}" is too large (max ${Math.floor(MAX_FILE_BYTES / (1024 * 1024))} MB).`)
          return
        }
        if (!isAllowedAssignmentMime(file.type, file.name)) {
          reportIssue(
            'Assignment upload',
            `"${file.name}" is not an allowed type (PDF, Word, Excel, CSV, images, or MP4).` +
            (!file.type ? ' Your device did not report a file type — try picking from the Files app.' : ` (detected: ${file.type})`)
          )
          return
        }
        if (IS_ANDROID && file.size > ANDROID_WARN_BYTES) {
          reportIssue(
            'File too large for mobile',
            `"${file.name}" is ${Math.round(file.size / (1024 * 1024))} MB. Please keep files under 50 MB on mobile, or upload from a desktop browser.`
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

      await queryClient.invalidateQueries({ queryKey: queryKeys.assignmentSubmission({ assignmentId }) })
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
        fileId === 'legacy'
          ? `?assignmentId=${encodeURIComponent(assignmentId)}`
          : ''
      const res = await fetchWithRetry(`/api/assignments/files/${encodeURIComponent(fileId)}${q}`, {
        method: 'DELETE',
      })
      const payload = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        reportIssue('Assignment file', payload.error ?? 'Could not remove file.')
        return
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.assignmentSubmission({ assignmentId }) })
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : 'Network error while removing file.'
      reportIssue('Assignment file', msg)
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
        reportIssue(
          'Turn in',
          payload.error ?? `Could not turn in (HTTP ${res.status}).`,
        )
        return
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.assignmentSubmission({ assignmentId }) })
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : 'Network error while turning in.'
      reportIssue('Turn in', msg)
    } finally {
      setActionLoading(false)
    }
  }

  async function unsubmit() {
    setActionLoading(true)
    try {
      const res = await fetchWithRetry('/api/assignments/unsubmit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignmentId }),
      })
      const payload = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        reportIssue(
          'Unsubmit',
          payload.error ?? `Could not unsubmit (HTTP ${res.status}).`,
        )
        return
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.assignmentSubmission({ assignmentId }) })
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : 'Network error while unsubmitting.'
      reportIssue('Unsubmit', msg)
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
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-800">Submission status</p>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              graded
                ? 'bg-emerald-100 text-emerald-700'
                : turnedIn
                ? 'bg-blue-100 text-blue-700'
                : 'bg-slate-200 text-slate-700'
            }`}
          >
            {statusLabel}
          </span>
        </div>
        {turnedIn && submission?.turnedInAt && !graded && (
          <p className="mt-1 text-xs text-slate-600">
            Submitted on {new Date(submission.turnedInAt).toLocaleString()}
          </p>
        )}
        {!turnedIn && !graded && (
          <p className="mt-1 text-xs text-slate-600">
            Add your files and click <span className="font-semibold">Turn in</span> when ready.
          </p>
        )}
      </div>

      {graded && submission && (
        <div className={`rounded-xl border ${submission.isPassed ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-100'} p-4 space-y-2`}>
          <div className={`flex items-center gap-2 ${submission.isPassed ? 'text-emerald-800' : 'text-red-800'} font-semibold`}>
            <CheckCircle2 className="h-5 w-5" />
            Graded
          </div>
          <p className={`text-sm ${submission.isPassed ? 'text-emerald-900' : 'text-red-900'}`}>
            Score:{' '}
            <strong>
              {submission.score ?? '—'}
              {submission.maxScore != null ? ` / ${submission.maxScore}` : ''}
            </strong>
            {submission.isPassed != null && (
              <span className="ml-2">
                ({submission.isPassed ? 'Passed' : 'Not passed'})
              </span>
            )}
          </p>
          {submission.feedback && (
            <p className="text-sm text-slate-900 whitespace-pre-wrap">
              <span className="font-medium">Feedback:</span> {submission.feedback}
            </p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-700">Your work</p>
        {files.length === 0 ? (
          <p className="text-sm text-slate-500">No files attached yet.</p>
        ) : (
          <ul className="space-y-2">
            {files.map((f) => (
              <li
                key={f.id}
                className="border border-slate-200 rounded-xl p-3 flex items-center justify-between bg-white shadow-sm gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-lg shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{f.original_name}</p>
                    <a
                      href={f.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Open in Google Drive
                    </a>
                  </div>
                </div>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => void removeFile(f.id)}
                    disabled={actionLoading || uploading}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition shrink-0"
                    title="Remove"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {canEdit && (
        <label
          className={`border-2 border-dashed border-slate-300 rounded-xl p-6 flex flex-col items-center justify-center transition ${
            uploading ? 'pointer-events-none border-blue-200 bg-blue-50/40' : 'cursor-pointer hover:border-blue-400 hover:bg-blue-50/50'
          }`}
        >
          {uploading && uploadUi ? (
            <>
              <p className="text-sm font-semibold text-slate-800 mb-3">Uploading…</p>
              <div
                className="w-full max-w-xs mb-2"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={uploadUi.overallPercent}
                aria-label={`Upload progress ${uploadUi.overallPercent} percent`}
              >
                <div className="h-2.5 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-600 transition-[width] duration-200 ease-out"
                    style={{ width: `${uploadUi.overallPercent}%` }}
                  />
                </div>
              </div>
              <p className="text-lg font-bold tabular-nums text-blue-700">{uploadUi.overallPercent}%</p>
              <p
                className="text-xs text-slate-500 mt-1 text-center max-w-full px-2 truncate"
                title={`${uploadUi.fileLabel} — file ${uploadUi.fileIndex} of ${uploadUi.fileTotal}`}
              >
                {uploadUi.fileLabel}
                <span className="text-slate-400">
                  {' '}
                  · File {uploadUi.fileIndex} of {uploadUi.fileTotal}
                </span>
              </p>
            </>
          ) : uploading ? (
            <>
              <Loader2 className="h-8 w-8 text-blue-500 animate-spin mb-2" />
              <p className="text-slate-600 font-medium text-sm text-center">Preparing upload…</p>
            </>
          ) : (
            <>
              <Upload className="h-8 w-8 text-slate-300 mb-2" />
              <p className="text-slate-600 font-medium text-sm text-center">Add files</p>
            </>
          )}
          {!uploading && (
            <p className="text-slate-400 text-xs mt-1 text-center">
              PDF, Word, Excel, CSV, images, MP4 · Up to {MAX_FILES_PER_SUBMISSION} files ·{' '}
              {Math.floor(MAX_FILE_BYTES / (1024 * 1024))} MB each
            </p>
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

      {!isLocked && (
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          {canEdit && (
            <button
              type="button"
              onClick={() => void turnIn()}
              disabled={
                actionLoading ||
                uploading ||
                files.length === 0
              }
              className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 px-6 rounded-lg shadow transition"
            >
              {actionLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
              Turn in
            </button>
          )}
          {canUnsubmit && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full">
              <p className="text-sm text-slate-600 flex-1">
                Your work is turned in. Unsubmit if you need to change or add files.
              </p>
              <button
                type="button"
                onClick={() => void unsubmit()}
                disabled={actionLoading}
                className="inline-flex items-center justify-center gap-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-semibold py-3 px-6 rounded-lg transition"
              >
                <Undo2 className="h-5 w-5" />
                Unsubmit
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
