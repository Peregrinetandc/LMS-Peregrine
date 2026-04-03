import { createHash } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { signSheetExportRequest } from './sheetExportAuth'
import { syncOneRow, type SheetRowInput } from './syncEngine'

export type SheetExportPayload = {
  spreadsheetId: string
  sheetName: string
  rows: SheetRowInput[]
}

export function buildPayloadHash(row: {
  email: string
  password: string
  course_id: string
  full_name: string
}): string {
  const parts = [row.email, row.password, row.course_id, row.full_name].map((x) =>
    String(x ?? '').trim(),
  )
  return createHash('sha256').update(parts.join('\u0001'), 'utf8').digest('hex')
}

export async function fetchSheetExport(webAppUrl: string, secret: string): Promise<SheetExportPayload> {
  const { timestamp, signature } = signSheetExportRequest(secret)
  const res = await fetch(webAppUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ timestamp, signature }),
    cache: 'no-store',
  })
  const text = await res.text()
  let json: unknown
  try {
    json = JSON.parse(text) as Record<string, unknown>
  } catch {
    throw new Error(`Sheet export: invalid JSON (${res.status}): ${text.slice(0, 500)}`)
  }
  const obj = json as { error?: string; spreadsheetId?: string; sheetName?: string; rows?: SheetRowInput[] }
  if (obj.error) {
    throw new Error(`Sheet export: ${obj.error}`)
  }
  if (!obj.spreadsheetId || !obj.sheetName || !Array.isArray(obj.rows)) {
    throw new Error('Sheet export: missing spreadsheetId, sheetName, or rows')
  }
  return {
    spreadsheetId: String(obj.spreadsheetId),
    sheetName: String(obj.sheetName),
    rows: obj.rows,
  }
}

type RowStateRow = {
  row_number: number
  payload_hash: string
  last_outcome: string
}

export type RunSheetSyncResult = {
  runId: string
  status: 'success' | 'partial' | 'failed'
  rowsTotal: number
  rowsOk: number
  rowsSkipped: number
  errorSummary: string | null
  details: { rows: Array<{ rowNumber: number; outcome: string; message?: string; skipped?: boolean }> }
}

/**
 * Fetch sheet from Apps Script, sync rows into Supabase, record run + row state.
 */
export async function runSheetSync(options: {
  admin: SupabaseClient
  instructorId: string
  webAppUrl: string
  exportSecret: string
  force?: boolean
}): Promise<RunSheetSyncResult> {
  const { admin, instructorId, webAppUrl, exportSecret, force } = options

  const { data: runInsert, error: runInsertErr } = await admin
    .from('sheet_sync_runs')
    .insert({
      status: 'running',
      rows_total: 0,
      rows_ok: 0,
      rows_skipped: 0,
    })
    .select('id')
    .single()

  if (runInsertErr || !runInsert?.id) {
    throw new Error(`Could not create sheet_sync_run: ${runInsertErr?.message}`)
  }

  const runId = runInsert.id as string

  const details: RunSheetSyncResult['details']['rows'] = []

  try {
    const payload = await fetchSheetExport(webAppUrl, exportSecret)
    const sourceId = payload.spreadsheetId
    const sheetName = payload.sheetName
    const rows = payload.rows
    const rowsTotal = rows.length

    const { data: existingStates } = await admin
      .from('sheet_sync_row_state')
      .select('row_number, payload_hash, last_outcome')
      .eq('source_id', sourceId)
      .eq('sheet_name', sheetName)

    const stateByRow = new Map<number, RowStateRow>()
    for (const s of existingStates || []) {
      stateByRow.set(s.row_number, s as RowStateRow)
    }

    let rowsOk = 0
    let rowsSkipped = 0
    let anyPartial = false
    let anyError = false

    for (const row of rows) {
      const hash = buildPayloadHash(row)
      const prev = stateByRow.get(row.rowNumber)

      if (
        !force &&
        prev &&
        prev.payload_hash === hash &&
        (prev.last_outcome === 'synced' || prev.last_outcome === 'skipped')
      ) {
        rowsSkipped++
        details.push({ rowNumber: row.rowNumber, outcome: prev.last_outcome, skipped: true })
        continue
      }

      const result = await syncOneRow(admin, instructorId, row)

      const errText =
        result.outcome === 'error' || result.outcome === 'partial' ? result.message ?? null : null

      await admin.from('sheet_sync_row_state').upsert(
        {
          source_id: sourceId,
          sheet_name: sheetName,
          row_number: row.rowNumber,
          payload_hash: hash,
          last_outcome: result.outcome,
          last_error: errText,
          updated_at: new Date().toISOString(),
          last_run_id: runId,
        },
        { onConflict: 'source_id,sheet_name,row_number' },
      )

      details.push({
        rowNumber: result.rowNumber,
        outcome: result.outcome,
        message: result.message,
      })

      if (result.outcome === 'synced') {
        rowsOk++
      } else if (result.outcome === 'skipped') {
        rowsSkipped++
      } else if (result.outcome === 'partial') {
        anyPartial = true
      } else if (result.outcome === 'error') {
        anyError = true
      }
    }

    let status: RunSheetSyncResult['status'] = 'success'
    if (anyError || anyPartial) status = 'partial'

    const errorSummary =
      anyError || anyPartial
        ? details
            .filter((d) => d.outcome === 'error' || d.outcome === 'partial')
            .map((d) => `row ${d.rowNumber}: ${d.message || d.outcome}`)
            .slice(0, 20)
            .join('; ') || null
        : null

    await admin
      .from('sheet_sync_runs')
      .update({
        finished_at: new Date().toISOString(),
        status,
        rows_total: rowsTotal,
        rows_ok: rowsOk,
        rows_skipped: rowsSkipped,
        error_summary: errorSummary,
        details: { rows: details },
      })
      .eq('id', runId)

    return {
      runId,
      status,
      rowsTotal,
      rowsOk,
      rowsSkipped,
      errorSummary,
      details: { rows: details },
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await admin
      .from('sheet_sync_runs')
      .update({
        finished_at: new Date().toISOString(),
        status: 'failed',
        error_summary: msg,
        details: { rows: details, error: msg },
      })
      .eq('id', runId)
    throw e
  }
}
