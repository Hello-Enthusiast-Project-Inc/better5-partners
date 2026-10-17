// Lead handler for partners.better5.com
// Writes the demo-form lead directly to a Google Sheet via the Sheets REST API,
// authenticating with a Google service account (no tunnel, no second server).
// Optionally pings a Telegram chat on each new lead.
//
// Required env vars (set in Vercel project better5-partners):
//   GOOGLE_SA_EMAIL        service account client_email
//   GOOGLE_SA_PRIVATE_KEY  service account private_key (PEM; literal \n allowed)
//   LEADS_SHEET_ID         target spreadsheet id
// Optional:
//   LEADS_SHEET_TAB        tab name (default "Sheet1")
//   RESEND_API_KEY         Resend API key for new-lead email notification
//   LEAD_NOTIFY_FROM       verified sender, e.g. "Better5 Leads <leads@better5.com>"
//   LEAD_NOTIFY_TO         comma-separated recipients (default kelsey+danielle)

import crypto from 'crypto';

const SHEET_TAB = process.env.LEADS_SHEET_TAB || 'Sheet1';

function b64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function getAccessToken() {
  const email = process.env.GOOGLE_SA_EMAIL;
  let key = process.env.GOOGLE_SA_PRIVATE_KEY;
  if (!email || !key) throw new Error('Missing GOOGLE_SA_EMAIL / GOOGLE_SA_PRIVATE_KEY');
  // Vercel stores the key with escaped newlines; normalize to real PEM newlines.
  key = key.replace(/\\n/g, '\n');

  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(JSON.stringify({
    iss: email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const signingInput = `${header}.${claim}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signingInput);
  const signature = b64url(signer.sign(key));
  const jwt = `${signingInput}.${signature}`;

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  if (!resp.ok) {
    throw new Error('Token exchange failed: ' + (await resp.text()));
  }
  const json = await resp.json();
  return json.access_token;
}

async function appendRow(token, row) {
  const sheetId = process.env.LEADS_SHEET_ID;
  if (!sheetId) throw new Error('Missing LEADS_SHEET_ID');
  const range = encodeURIComponent(`${SHEET_TAB}!A:J`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}:append`
    + `?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [row] }),
  });
  if (!resp.ok) {
    throw new Error('Sheet append failed: ' + (await resp.text()));
  }
  return resp.json();
}

async function notifyEmail(data) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return; // notification is optional; never blocks lead capture
  const from = process.env.LEAD_NOTIFY_FROM || 'Better5 Leads <leads@better5.com>';
  const to = (process.env.LEAD_NOTIFY_TO || 'kelsey@better5.com,danielle@better5.com')
    .split(',').map((s) => s.trim()).filter(Boolean);

  const subject = `🏥 New Demo Request: ${data.facility || data.name || 'Unknown'}`;
  const lines = [
    'New demo request from partners.better5.com',
    '',
    `Name: ${data.name || '—'}`,
    `Role: ${data.role || '—'}`,
    `Facility: ${data.facility || '—'}`,
    `Location: ${data.location || '—'}`,
    `Residents: ${data.residents || '—'}`,
    `Email: ${data.email || '—'}`,
    `Phone: ${data.phone || '—'}`,
    '',
    'Message:',
    data.message || '(none)',
  ];
  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, text: lines.join('\n') }),
    });
    if (!resp.ok) console.error('Resend notify failed (non-fatal):', await resp.text());
  } catch (e) {
    console.error('Resend notify failed (non-fatal):', e.message);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const data = req.body || {};

    if (!data.email || !data.name || !data.facility) {
      return res.status(400).json({ error: 'Name, email and facility are required' });
    }

    const timestamp = new Date().toLocaleString('en-CA', { timeZone: 'America/Vancouver' });
    const row = [
      timestamp,
      data.name || '',
      data.role || '',
      data.facility || '',
      data.location || '',
      data.residents || '',
      data.email || '',
      data.phone || '',
      data.message || '',
      'partners.better5.com',
    ];

    const token = await getAccessToken();
    await appendRow(token, row);

    // Fire-and-forget notification; never blocks the lead capture.
    await notifyEmail(data);

    return res.status(200).json({ status: 'ok' });
  } catch (err) {
    console.error('Lead API error:', err);
    return res.status(500).json({ error: 'Failed to save — please try again', message: err.message });
  }
}
