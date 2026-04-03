import { createHmac } from 'crypto'

/** Must match SheetExportWebApp.gs EXPORT_CANONICAL_MESSAGE_SUFFIX */
const CANONICAL_SUFFIX = 'sheet-export'

/**
 * Build HMAC-SHA256 hex for Apps Script export auth:
 * message = `${timestamp}\n${CANONICAL_SUFFIX}`
 */
export function signSheetExportRequest(secret: string): { timestamp: string; signature: string } {
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const message = `${timestamp}\n${CANONICAL_SUFFIX}`
  const signature = createHmac('sha256', secret).update(message).digest('hex')
  return { timestamp, signature }
}
