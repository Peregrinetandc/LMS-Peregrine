import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { requireAdminApi } from '@/utils/supabase/admin'
import { uploadAssignmentToDrive } from '@/utils/google-drive'
import {
  guessMime,
  isAllowedAssignmentMime,
  MAX_FILE_BYTES,
  MAX_FILES_PER_SUBMISSION,
} from '@/lib/assignment-files'

export const runtime = 'nodejs'
/** Large uploads + Drive need time; without this, hosts may cut the connection → client "Failed to fetch". */
export const maxDuration = 300

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const assignmentId = searchParams.get('assignmentId')?.trim()
    const rawFileName = searchParams.get('fileName') ?? ''
    const fileName = decodeURIComponent(rawFileName) || 'upload'
    const clientMime = searchParams.get('mimeType') ? decodeURIComponent(searchParams.get('mimeType')!) : ''

    if (!assignmentId) {
      return NextResponse.json({ error: 'Missing assignmentId' }, { status: 400 })
    }

    const contentLength = Number(request.headers.get('content-length') ?? '0')
    if (contentLength > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `Each file must be under ${Math.floor(MAX_FILE_BYTES / (1024 * 1024))} MB.` },
        { status: 400 },
      )
    }

    const mime = clientMime || guessMime(fileName)
    if (!isAllowedAssignmentMime(mime, fileName)) {
      return NextResponse.json(
        { error: 'Allowed types: PDF, Word (.doc/.docx), Excel/CSV, images (PNG, JPEG, GIF, WebP), MP4 video.' },
        { status: 400 },
      )
    }

    const adminGate = requireAdminApi()
    if (!adminGate.ok) return adminGate.response
    const db = adminGate.admin

    const { data: existing, error: exErr } = await db
      .from('submissions')
      .select('id, is_turned_in, graded_at')
      .eq('assignment_id', assignmentId)
      .eq('learner_id', user.id)
      .maybeSingle()

    if (exErr) {
      console.error(exErr)
      return NextResponse.json({ error: exErr.message }, { status: 500 })
    }
    if (existing?.graded_at) {
      return NextResponse.json({ error: 'This assignment is already graded.' }, { status: 400 })
    }
    if (existing?.is_turned_in) {
      return NextResponse.json({ error: 'Unsubmit your work before adding or removing files.' }, { status: 400 })
    }

    let submissionId = existing?.id as string | undefined
    if (!submissionId) {
      const { data: created, error: insErr } = await db
        .from('submissions')
        .insert({
          assignment_id: assignmentId,
          learner_id: user.id,
          is_turned_in: false,
          storage_provider: 'google_drive',
        })
        .select('id')
        .single()

      if (insErr || !created) {
        console.error(insErr)
        return NextResponse.json({ error: insErr?.message ?? 'Could not create submission.' }, { status: 500 })
      }
      submissionId = created.id
    }

    const { count, error: cntErr } = await db
      .from('submission_files')
      .select('*', { count: 'exact', head: true })
      .eq('submission_id', submissionId)

    if (cntErr) {
      return NextResponse.json({ error: cntErr.message }, { status: 500 })
    }

    const legacyRow = await db.from('submissions').select('file_url').eq('id', submissionId).single()
    const hasLegacyOnly = legacyRow.data?.file_url && (count ?? 0) === 0
    const effectiveCount = (count ?? 0) + (hasLegacyOnly ? 1 : 0)
    if (effectiveCount >= MAX_FILES_PER_SUBMISSION) {
      return NextResponse.json({ error: `You can attach up to ${MAX_FILES_PER_SUBMISSION} files.` }, { status: 400 })
    }

    // Read stream into buffer — but now content-length is checked first so we
    // know it's within limits before buffering
    if (!request.body) {
      return NextResponse.json({ error: 'No file body received.' }, { status: 400 })
    }
    const chunks: Uint8Array[] = []
    let received = 0
    const reader = request.body.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) {
        received += value.byteLength
        if (received > MAX_FILE_BYTES) {
          return NextResponse.json(
            { error: `File exceeds ${Math.floor(MAX_FILE_BYTES / (1024 * 1024))} MB limit.` },
            { status: 400 }
          )
        }
        chunks.push(value)
      }
    }
    const buffer = Buffer.concat(chunks)

    const safeSegment = fileName.replace(/[^\w.\-]+/g, '_')
    const uploadName = `assignment_${assignmentId}_${user.id}_${Date.now()}_${safeSegment}`

    const { webViewLink, fileId: driveFileId } = await uploadAssignmentToDrive({
      buffer,
      fileName: uploadName,
      mimeType: mime,
    })

    const nextOrder = count ?? 0
    const { error: fileErr } = await db.from('submission_files').insert({
      submission_id: submissionId,
      file_url: webViewLink,
      drive_file_id: driveFileId,
      original_name: fileName,
      sort_order: nextOrder,
    })

    if (fileErr) {
      console.error(fileErr)
      return NextResponse.json({ error: fileErr.message }, { status: 500 })
    }

    const { data: firstRow } = await db
      .from('submission_files')
      .select('file_url')
      .eq('submission_id', submissionId)
      .order('sort_order', { ascending: true })
      .limit(1)
      .maybeSingle()

    const primaryUrl = firstRow?.file_url ?? webViewLink
    const { error: upErr } = await db
      .from('submissions')
      .update({ file_url: primaryUrl, drive_file_id: driveFileId, submitted_at: new Date().toISOString() })
      .eq('id', submissionId)

    if (upErr) {
      console.error(upErr)
      return NextResponse.json({ error: upErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, fileUrl: webViewLink, submissionId, driveFileId })

  } catch (e) {
    console.error(e)
    const message = e instanceof Error ? e.message : 'Upload failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}