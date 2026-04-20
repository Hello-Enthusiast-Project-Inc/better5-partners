// Better5 Partners Contact Form Handler
// Deploy as a Google Apps Script Web App (Execute as: Me, Access: Anyone)
// Paste this into: script.google.com → New Project

const SHEET_ID = '1oQPsdv7dHvG-iC8FtH_8I17ZV6cNDt8EI3tJ3qriRsA';
const SHEET_NAME = 'Sheet1';
const NOTIFY_EMAILS = ['kelsey@better5.com', 'danielle@better5.com'];

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    
    // Open sheet by ID
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(SHEET_NAME);
    // Append row
    sheet.appendRow([
      new Date().toLocaleString('en-CA', {timeZone: 'America/Vancouver'}),
      data.name || '',
      data.role || '',
      data.facility || '',
      data.location || '',
      data.residents || '',
      data.email || '',
      data.phone || '',
      data.message || '',
      data.source || 'partners.better5.com'
    ]);
    
    // Send email notification
    var subject = '🏥 New Demo Request: ' + (data.facility || data.name || 'Unknown');
    var body = [
      'New demo request from partners.better5.com',
      '',
      'Name: ' + (data.name || '—'),
      'Role: ' + (data.role || '—'),
      'Facility: ' + (data.facility || '—'),
      'Location: ' + (data.location || '—'),
      'Residents: ' + (data.residents || '—'),
      'Email: ' + (data.email || '—'),
      'Phone: ' + (data.phone || '—'),
      '',
      'Message:',
      data.message || '(none)',
      '',
      'Submitted: ' + new Date().toLocaleString('en-CA', {timeZone: 'America/Vancouver'})
    ].join('\n');
    
    NOTIFY_EMAILS.forEach(function(email) {
      MailApp.sendEmail(email, subject, body);
    });
    
    return ContentService
      .createTextOutput(JSON.stringify({status: 'ok'}))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch(err) {
    return ContentService
      .createTextOutput(JSON.stringify({status: 'error', message: err.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
