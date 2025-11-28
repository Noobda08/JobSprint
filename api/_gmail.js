const querystring = require('querystring');

const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const OAUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me';

function buildOAuthUrl(state) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_REDIRECT_URI) {
    throw new Error('missing_google_oauth_env');
  }
  const params = querystring.stringify({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: GMAIL_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  return `${OAUTH_URL}?${params}`;
}

async function exchangeCodeForTokens(code) {
  const body = querystring.stringify({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI,
    grant_type: 'authorization_code'
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`token_exchange_failed:${text}`);
  }
  return res.json();
}

async function refreshAccessToken(refreshToken) {
  const body = querystring.stringify({
    refresh_token: refreshToken,
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    grant_type: 'refresh_token'
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`refresh_failed:${text}`);
  }
  return res.json();
}

async function gmailRequest(path, accessToken, options = {}) {
  const res = await fetch(`${GMAIL_API}${path}`, {
    ...options,
    headers: {
      'authorization': `Bearer ${accessToken}`,
      'content-type': 'application/json',
      ...(options.headers || {})
    }
  });
  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`gmail_error:${res.status}:${text}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

async function getProfile(accessToken) {
  return gmailRequest('/profile', accessToken);
}

async function registerWatch(accessToken) {
  if (!process.env.GMAIL_PUBSUB_TOPIC) {
    throw new Error('missing_pubsub_topic');
  }
  const payload = {
    topicName: process.env.GMAIL_PUBSUB_TOPIC,
    labelIds: ['INBOX'],
  };
  return gmailRequest('/watch', accessToken, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

async function listHistory(accessToken, startHistoryId) {
  const url = `/history?startHistoryId=${encodeURIComponent(startHistoryId)}&historyTypes=messageAdded`;
  return gmailRequest(url, accessToken);
}

async function getMessage(accessToken, id) {
  return gmailRequest(`/messages/${id}?format=full`, accessToken);
}

function parseMimeBody(parts = []) {
  const walk = (list) => {
    for (const part of list) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return Buffer.from(part.body.data, 'base64').toString('utf8');
      }
      if (part.parts) {
        const nested = walk(part.parts);
        if (nested) return nested;
      }
    }
    return '';
  };
  return walk(parts);
}

function parseJobApplication(message) {
  const headers = Object.fromEntries((message.payload?.headers || []).map(h => [h.name.toLowerCase(), h.value]));
  const subject = headers['subject'] || '';
  const from = headers['from'] || '';
  const dateHeader = headers['date'];
  const snippet = message.snippet || '';
  const bodyText = parseMimeBody(message.payload?.parts || []) || snippet;
  const patterns = [
    /application (received|submitted)/i,
    /applied to/i,
    /thanks for applying/i,
    /your application/i,
  ];
  const senderPatterns = [/linkedin/i, /indeed/i, /naukri/i, /monster/i, /greenhouse/i];
  const looksLikeJob = patterns.some(r => r.test(subject) || r.test(bodyText) || r.test(snippet)) || senderPatterns.some(r => r.test(from));
  if (!looksLikeJob) return null;

  const titleMatch = subject.match(/for (.+?) at (.+)/i);
  const jobTitle = titleMatch ? titleMatch[1].trim() : (subject.split(' at ')[0] || '').replace(/application/i, '').trim();
  const company = titleMatch ? titleMatch[2].trim() : '';
  const linkMatch = bodyText.match(/https?:\/\/\S+/i);
  const platformMatch = senderPatterns.find(r => r.test(from));
  const platform = platformMatch ? from.match(/([a-zA-Z]+)\./)?.[1] || 'Gmail' : '';

  const appliedDate = dateHeader ? new Date(dateHeader) : null;
  const safeTitle = jobTitle || 'Job Application';
  const safeCompany = company || 'Unknown Company';

  return {
    company: safeCompany,
    role: safeTitle,
    platform: platform || 'Email',
    source: platform || 'Email',
    applied_date: appliedDate && !Number.isNaN(appliedDate.getTime()) ? appliedDate.toISOString().slice(0, 10) : null,
    job_link: linkMatch ? linkMatch[0] : '',
  };
}

module.exports = {
  buildOAuthUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  getProfile,
  registerWatch,
  listHistory,
  getMessage,
  parseJobApplication,
};
