// Lead handler for partners.better5.com — forwards to a Google Apps Script
// Web App that appends to the leads sheet and emails Kelsey + Danielle.
// Destination is configured via env var LEAD_WEBHOOK_URL (no hardcoded host).

const WEBHOOK_URL = process.env.LEAD_WEBHOOK_URL;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!WEBHOOK_URL) {
    console.error('Lead API error: LEAD_WEBHOOK_URL not configured');
    return res.status(500).json({ error: 'Lead destination not configured' });
  }

  try {
    const data = req.body || {};

    if (!data.email || !data.name || !data.facility) {
      return res.status(400).json({ error: 'Name, email and facility are required' });
    }

    const payload = {
      name: data.name || '',
      role: data.role || '',
      facility: data.facility || '',
      location: data.location || '',
      residents: data.residents || '',
      email: data.email || '',
      phone: data.phone || '',
      message: data.message || '',
      source: 'partners.better5.com',
    };

    const upstream = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      redirect: 'follow', // Apps Script Web Apps 302 to script.googleusercontent.com
    });

    if (!upstream.ok) {
      const err = await upstream.text();
      throw new Error('Webhook error: ' + err);
    }

    return res.status(200).json({ status: 'ok' });
  } catch (err) {
    console.error('Lead API error:', err);
    return res.status(500).json({ error: 'Failed to save — please try again', message: err.message });
  }
}
