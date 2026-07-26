/**
 * Or Bachelor — RSVP logger (Google Apps Script Web App)
 * Receives each RSVP from the boarding-pass site and appends a row to this Sheet.
 *
 * SETUP (one time):
 *  1. Create a new Google Sheet:  https://sheets.new   (name it e.g. "Or Bachelor RSVPs")
 *  2. In the Sheet: Extensions -> Apps Script
 *  3. Delete whatever is there, paste ALL of this file, click Save (disk icon)
 *  4. Deploy -> New deployment
 *       - Type (gear icon):  Web app
 *       - Description:       rsvp logger
 *       - Execute as:        Me
 *       - Who has access:    Anyone
 *     Deploy -> Authorize access -> pick your account -> Advanced -> "Go to ... (unsafe)" -> Allow
 *  5. Copy the "Web app" URL (it ends with /exec) and send it back.
 *
 * To read results: just open the Sheet — rows appear as people RSVP.
 * The latest row for each name is that person's current answer.
 */

function doPost(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('RSVPs') || ss.insertSheet('RSVPs');
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['Timestamp', 'Name', 'Choice']);
    }
    var p = (e && e.parameter) ? e.parameter : {};
    sheet.appendRow([new Date(), p.name || '', p.choice || '']);
    return ContentService.createTextOutput('ok');
  } catch (err) {
    return ContentService.createTextOutput('error: ' + err);
  }
}

function doGet() {
  return ContentService.createTextOutput('Or Bachelor RSVP logger is running.');
}
