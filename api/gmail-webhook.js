const { supabaseAdmin } = require('./_supabase.js');
const { listHistory, getMessage, parseJobApplication, refreshAccessToken } = require('./_gmail.js');

async function ensureAccessToken(integration) {
  if (!integration.token_expires_at || !integration.refresh_token) {
    return integration.access_token;
  }
  const expired = new Date(integration.token_expires_at).getTime() < Date.now();
  if (!expired) return integration.access_token;
  const refreshed = await refreshAccessToken(integration.refresh_token);
  const newToken = refreshed.access_token;
  const expiresAt = refreshed.expires_in ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString() : null;
  await supabaseAdmin
    .from('gmail_integrations')
    .update({ access_token: newToken, token_expires_at: expiresAt })
    .eq('id', integration.id);
  return newToken;
}

async function upsertApplication(userId, parsed, gmailMessageId) {
  const payload = {
    user_id: userId,
    company: parsed.company || 'Unknown Company',
    role: parsed.role || 'Job Application',
    status: 'applied',
    applied_date: parsed.applied_date || null,
    source: parsed.source || parsed.platform || 'Email',
    platform: parsed.platform || null,
    link: parsed.job_link || '',
    gmail_message_id: gmailMessageId,
  };

  const { error } = await supabaseAdmin
    .from('applications')
    .upsert(payload, { onConflict: 'user_id,gmail_message_id' });

  if (error) {
    console.error('application upsert error', error);
  }
}

async function processHistory(accessToken, integration, historyId) {
  const lastHistory = integration.last_history_id || historyId;
  const history = await listHistory(accessToken, lastHistory);
  const historyItems = history.history || [];
  const newHistoryId = history.historyId || historyId;

  for (const item of historyItems) {
    const messages = item.messagesAdded || [];
    for (const wrapper of messages) {
      const messageId = wrapper.message?.id;
      if (!messageId) continue;
      try {
        const message = await getMessage(accessToken, messageId);
        const parsed = parseJobApplication(message);
        if (parsed) {
          await upsertApplication(integration.user_id, parsed, messageId);
        }
      } catch (err) {
        console.error('failed to process message', err);
      }
    }
  }

  await supabaseAdmin
    .from('gmail_integrations')
    .update({ last_history_id: newHistoryId })
    .eq('id', integration.id);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  if (process.env.GMAIL_WEBHOOK_SECRET) {
    const token = req.headers['x-jobsprint-webhook'];
    if (token !== process.env.GMAIL_WEBHOOK_SECRET) {
      return res.status(401).json({ error: 'unauthorized' });
    }
  }

  const message = req.body?.message;
  if (!message) return res.status(400).json({ error: 'missing_message' });
  let data = {};
  try {
    const decoded = Buffer.from(message.data, 'base64').toString('utf8');
    data = JSON.parse(decoded);
  } catch (err) {
    return res.status(400).json({ error: 'invalid_payload' });
  }

  const emailAddress = data.emailAddress;
  const historyId = data.historyId;
  if (!emailAddress || !historyId) {
    return res.status(200).json({ ignored: true });
  }

  const { data: integration, error } = await supabaseAdmin
    .from('gmail_integrations')
    .select('*')
    .eq('gmail_address', emailAddress)
    .maybeSingle();

  if (error || !integration) {
    return res.status(200).json({ ignored: true });
  }

  try {
    const accessToken = await ensureAccessToken(integration);
    await processHistory(accessToken, integration, historyId);
    return res.status(200).json({ processed: true });
  } catch (err) {
    console.error('webhook processing failed', err);
    return res.status(500).json({ error: 'processing_failed', detail: err.message });
  }
};
