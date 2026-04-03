/**
 * Peregrine T&C – Secure sheet export (Web App)
 *
 * Exposes read-only JSON of the active sheet for server-side Supabase sync.
 * No Supabase keys in this file — only SHEETS_EXPORT_SECRET for HMAC verification.
 *
 * Sheet layout:
 *   Row 1: email | password | course_id | full_name
 *   Row 2: optional labels
 *   Row 3+: data
 *
 * Setup:
 *   1. Script properties: SHEETS_EXPORT_SECRET = long random string (same value in Vercel env)
 *   2. Deploy → New deployment → Web app → Execute as: Me; Who has access: Anyone (auth is HMAC)
 *   3. Copy Web App URL → GOOGLE_APPS_SCRIPT_WEBAPP_URL on Vercel
 *
 * Request: POST (recommended) or GET with query params
 *   timestamp — Unix seconds (string or number)
 *   signature — hex HMAC-SHA256 of: timestamp + "\\n" + "sheet-export"
 *
 * Response JSON:
 *   { spreadsheetId, sheetName, rows: [{ rowNumber, email, password, course_id, full_name }] }
 *
 * Data window: only rows EXPORT_DATA_START_ROW … SHEET_DATA_LAST_ROW (inclusive) are read.
 * Raise SHEET_DATA_LAST_ROW if you add data below that row.
 */

var EXPORT_DATA_START_ROW = 3;
/** Last row that sync/fingerprint considers (spreadsheet may extend farther empty). */
var SHEET_DATA_LAST_ROW = 200;
var EXPORT_CANONICAL_MESSAGE_SUFFIX = 'sheet-export';
var EXPORT_MAX_TIMESTAMP_SKEW_SEC = 300;

function bytesToHex_(bytes) {
  return bytes
    .map(function (b) {
      var n = b < 0 ? b + 256 : b;
      return ('0' + n.toString(16)).slice(-2);
    })
    .join('');
}

function verifyExportSignature_(secret, timestampStr, signatureHex) {
  if (!secret || !timestampStr || !signatureHex) return false;
  var ts = parseInt(String(timestampStr), 10);
  if (isNaN(ts)) return false;
  var now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > EXPORT_MAX_TIMESTAMP_SKEW_SEC) return false;
  var message = String(timestampStr) + '\n' + EXPORT_CANONICAL_MESSAGE_SUFFIX;
  var sig = Utilities.computeHmacSha256Signature(message, secret);
  var expected = bytesToHex_(sig).toLowerCase();
  return expected === String(signatureHex).trim().toLowerCase();
}

function readExportRows_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  var name = sheet.getName();
  var last = Math.min(sheet.getLastRow(), SHEET_DATA_LAST_ROW);
  var rows = [];
  for (var r = EXPORT_DATA_START_ROW; r <= last; r++) {
    rows.push({
      rowNumber: r,
      email: String(sheet.getRange(r, 1).getValue() || '').trim(),
      password: String(sheet.getRange(r, 2).getValue() || '').trim(),
      course_id: String(sheet.getRange(r, 3).getValue() || '').trim(),
      full_name: String(sheet.getRange(r, 4).getValue() || '').trim(),
    });
  }
  return {
    spreadsheetId: ss.getId(),
    sheetName: name,
    rows: rows,
  };
}

function jsonResponse_(obj, statusOk) {
  var out = JSON.stringify(obj);
  return ContentService.createTextOutput(out).setMimeType(ContentService.MimeType.JSON);
}

function handleExport_(params) {
  var props = PropertiesService.getScriptProperties();
  var secret = props.getProperty('SHEETS_EXPORT_SECRET');
  if (!secret) {
    return jsonResponse_({ error: 'SHEETS_EXPORT_SECRET not set in Script properties' }, false);
  }
  var ts = params.timestamp;
  var sig = params.signature;
  if (!verifyExportSignature_(secret, ts, sig)) {
    return jsonResponse_({ error: 'Unauthorized: invalid or expired signature' }, false);
  }
  try {
    var data = readExportRows_();
    return jsonResponse_(data, true);
  } catch (err) {
    return jsonResponse_({ error: String(err.message || err) }, false);
  }
}

/**
 * POST: JSON body { timestamp, signature } or form fields.
 */
function doPost(e) {
  var params = {};
  if (e.postData && e.postData.contents) {
    try {
      params = JSON.parse(e.postData.contents);
    } catch (ignore) {
      params = {};
    }
  }
  if (!params.timestamp && e.parameter) {
    params.timestamp = e.parameter.timestamp;
    params.signature = e.parameter.signature;
  }
  return handleExport_(params);
}

/**
 * GET: ?timestamp=...&signature=...
 */
function doGet(e) {
  return handleExport_(e.parameter || {});
}
