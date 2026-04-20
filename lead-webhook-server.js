// Better5 Partners Lead Webhook Server
// Runs on Mac mini port 18794, exposed via Cloudflare tunnel at brock-webhook.better5.com
// Receives lead data from Vercel API and writes to Google Sheet using gog

import { createServer } from 'http';
import { execSync } from 'child_process';

const PORT = 18794;
const SHEET_ID = '1oQPsdv7dHvG-iC8FtH_8I17ZV6cNDt8EI3tJ3qriRsA';
const SHEET_RANGE = 'Sheet1!A:J';
const ACCOUNT = 'brock@helloenthusiast.com';

const NOTIFY_EMAILS = ['kelsey@better5.com', 'danielle@better5.com'];

function appendToSheet(data) {
  const timestamp = new Date().toLocaleString('en-CA', { timeZone: 'America/Vancouver' });
  const values = JSON.stringify([[
    timestamp,
    data.name || '',
    data.role || '',
    data.facility || '',
    data.location || '',
    data.residents || '',
    data.email || '',
    data.phone || '',
    data.message || '',
    data.source || 'partners.better5.com',
  ]]);

  execSync(
    `gog sheets append ${SHEET_ID} "${SHEET_RANGE}" --values-json '${values}' --insert INSERT_ROWS --account ${ACCOUNT}`,
    { stdio: 'inherit' }
  );
}

const server = createServer((req, res) => {
  // Health check
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  if (req.method !== 'POST' || req.url !== '/lead') {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    try {
      const data = JSON.parse(body);

      if (!data.email || !data.name || !data.facility) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Name, email and facility are required' }));
        return;
      }

      appendToSheet(data);

      console.log(`[${new Date().toISOString()}] Lead saved: ${data.name} @ ${data.facility}`);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
    } catch (err) {
      console.error('Lead webhook error:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to save lead', message: err.message }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`Better5 lead webhook server running on port ${PORT}`);
  console.log(`Tunnel: https://brock-webhook.better5.com/lead`);
});
