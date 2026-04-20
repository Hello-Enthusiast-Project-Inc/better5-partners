const WEBHOOK_URL = 'https://brock-webhook.better5.com/lead';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const data = req.body;

    if (!data.email || !data.name || !data.facility) {
      return res.status(400).json({ error: 'Name, email and facility are required' });
    }

    const upstream = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, source: 'partners.better5.com' }),
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
