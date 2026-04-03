/**
 * Peregrine T&C – Hourly Vercel sync trigger (quota-friendly)
 *
 * Calls POST {VERCEL_SYNC_URL} with Bearer SHEET_SYNC_TRIGGER_SECRET only when
 * the active sheet’s data fingerprint (SHA-256 of rows) changed since the last
 * successful sync. Avoids UrlFetchApp on every tick when nothing edited.
 *
 * Sheet layout must match SheetExportWebApp.gs:
 *   Row 1: headers, row 2 optional, row 3+ = email | password | course_id | full_name
 *
 * Script properties (Project Settings → Script properties):
 *   VERCEL_SYNC_URL             = https://your-app.vercel.app/api/integrations/google-sheets/sync
 *   SHEET_SYNC_TRIGGER_SECRET   = same value as SHEET_SYNC_CRON_SECRET on Vercel
 *
 * Stored automatically after a successful HTTP response:
 *   LAST_SHEET_SYNC_FINGERPRINT = hex sha256 (do not set manually)
 *
 * One-time setup:
 *   1. Set the two properties above.
 *   2. Run setupVercelSyncHourlyTrigger() once in the editor (grant permissions).
 *   3. Check Executions / logs if needed.
 *
 * Manual full sync (ignores fingerprint): run forceVercelSheetSyncNow()
 */

var TRIGGER_DATA_START_ROW = 3;
var TRIGGER_DATA_NUM_COLS = 4;
var PROP_VERCEL_URL = 'VERCEL_SYNC_URL';
var PROP_TRIGGER_SECRET = 'SHEET_SYNC_TRIGGER_SECRET';
var PROP_LAST_FINGERPRINT = 'LAST_SHEET_SYNC_FINGERPRINT';

function bytesToHexDigest_(bytes) {
  return bytes
    .map(function (b) {
      var n = b < 0 ? b + 256 : b;
      return ('0' + n.toString(16)).slice(-2);
    })
    .join('');
}

/**
 * Stable fingerprint: spreadsheet id + sheet name + all data rows (cols A–D from row 3).
 * Matches the idea of “any visible export change” for the active sheet.
 */
function computeSheetSyncFingerprint_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  var lastRow = sheet.getLastRow();
  var header =
    String(ss.getId()) + '\u0002' + String(sheet.getName()) + '\u0002';
  if (lastRow < TRIGGER_DATA_START_ROW) {
    return fingerprintHash_(header);
  }
  var values = sheet.getRange(TRIGGER_DATA_START_ROW, 1, lastRow, TRIGGER_DATA_NUM_COLS).getValues();
  var lines = [];
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var parts = [];
    for (var j = 0; j < TRIGGER_DATA_NUM_COLS; j++) {
      parts.push(String(row[j] != null ? row[j] : '').trim());
    }
    lines.push(parts.join('\u0001'));
  }
  return fingerprintHash_(header + lines.join('\n'));
}

function fingerprintHash_(text) {
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8);
  return bytesToHexDigest_(digest);
}

function getVercelTriggerProps_() {
  var p = PropertiesService.getScriptProperties();
  var url = String(p.getProperty(PROP_VERCEL_URL) || '').trim();
  var secret = String(p.getProperty(PROP_TRIGGER_SECRET) || '').trim();
  if (!url || !secret) {
    throw new Error(
      'Set Script properties: ' + PROP_VERCEL_URL + ' and ' + PROP_TRIGGER_SECRET
    );
  }
  return { props: p, url: url, secret: secret };
}

/**
 * Hourly trigger target: POST to Vercel only if sheet content changed.
 */
function hourlyVercelSyncIfChanged() {
  var o;
  try {
    o = getVercelTriggerProps_();
  } catch (e) {
    Logger.log('hourlyVercelSyncIfChanged: ' + e);
    return;
  }
  var fp;
  try {
    fp = computeSheetSyncFingerprint_();
  } catch (e) {
    Logger.log('fingerprint failed: ' + e);
    return;
  }
  var last = o.props.getProperty(PROP_LAST_FINGERPRINT);
  if (last && last === fp) {
    Logger.log('Vercel sync skipped (unchanged sheet).');
    return;
  }
  var res = UrlFetchApp.fetch(o.url, {
    method: 'post',
    headers: {
      Authorization: 'Bearer ' + o.secret,
    },
    muteHttpExceptions: true,
  });
  var code = res.getResponseCode();
  var body = res.getContentText();
  if (code >= 200 && code < 300) {
    o.props.setProperty(PROP_LAST_FINGERPRINT, fp);
    Logger.log('Vercel sync OK (HTTP ' + code + '). Fingerprint saved.');
  } else {
    Logger.log('Vercel sync failed HTTP ' + code + ': ' + (body.length > 500 ? body.substring(0, 500) + '…' : body));
  }
}

/**
 * POST to Vercel regardless of fingerprint; updates stored fingerprint on success.
 */
function forceVercelSheetSyncNow() {
  var o = getVercelTriggerProps_();
  var fp = computeSheetSyncFingerprint_();
  var res = UrlFetchApp.fetch(o.url, {
    method: 'post',
    headers: {
      Authorization: 'Bearer ' + o.secret,
    },
    muteHttpExceptions: true,
  });
  var code = res.getResponseCode();
  var body = res.getContentText();
  if (code >= 200 && code < 300) {
    o.props.setProperty(PROP_LAST_FINGERPRINT, fp);
    Logger.log('Force Vercel sync OK (HTTP ' + code + ')');
  } else {
    throw new Error('Vercel sync failed HTTP ' + code + ': ' + body);
  }
}

/**
 * Install (or replace) an hourly time-driven trigger for hourlyVercelSyncIfChanged.
 * Run once from the script editor.
 */
function setupVercelSyncHourlyTrigger() {
  var fn = 'hourlyVercelSyncIfChanged';
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === fn) {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger(fn).timeBased().everyHours(1).create();
  Logger.log('Installed hourly trigger for ' + fn);
}
