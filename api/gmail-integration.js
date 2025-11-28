const { supabaseAdmin } = require('./_supabase.js');
const { findUserFromRequest } = require('./_users.js');
const { refreshAccessToken, registerWatch } = require('./_gmail.js');

module.exports = async function handler(req, res) {
  const { user, status, error, detail } = await findUserFromRequest(req);
  if (!user) return res.status(status || 400).json({ error, detail });

  if (req.method === 'GET') {
    const { data, error: lookupError } = await supabaseAdmin
      .from('gmail_integrations')
      .select('gmail_address, last_history_id, watch_expiration, token_expires_at')
      .eq('user_id', user.id)
      .maybeSingle();

    if (lookupError) return res.status(500).json({ error: 'supabase_error', detail: lookupError.message });
    return res.status(200).json({ integration: data || null });
  }

  if (req.method === 'POST') {
    try {
      const { data: integration, error: lookupError } = await supabaseAdmin
        .from('gmail_integrations')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (lookupError) {
        return res.status(500).json({ error: 'supabase_error', detail: lookupError.message });
      }
      if (!integration) {
        return res.status(404).json({ error: 'integration_not_found' });
      }

      let accessToken = integration.access_token;
      const needsRefresh = integration.token_expires_at && new Date(integration.token_expires_at).getTime() < Date.now();
      if (needsRefresh && integration.refresh_token) {
        const refreshed = await refreshAccessToken(integration.refresh_token);
        accessToken = refreshed.access_token;
        const expiresAt = refreshed.expires_in ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString() : null;
        await supabaseAdmin
          .from('gmail_integrations')
          .update({ access_token: accessToken, token_expires_at: expiresAt })
          .eq('id', integration.id);
      }

      const watch = await registerWatch(accessToken);
      const updatePayload = {
        last_history_id: watch.historyId,
        watch_expiration: watch.expiration ? new Date(Number(watch.expiration)).toISOString() : null,
      };
      await supabaseAdmin
        .from('gmail_integrations')
        .update(updatePayload)
        .eq('id', integration.id);

      return res.status(200).json({ watch: updatePayload });
    } catch (err) {
      return res.status(500).json({ error: 'watch_failed', detail: err.message });
    }
  }

  return res.status(405).json({ error: 'method_not_allowed' });
};
