const jwt = require('jsonwebtoken');

function getAuthorizationHeader(req) {
  return req?.headers?.authorization || req?.headers?.Authorization || '';
}

function extractBearerToken(authorizationHeader) {
  if (!authorizationHeader || typeof authorizationHeader !== 'string') {
    throw new Error('missing_authorization');
  }
  const [scheme, token] = authorizationHeader.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) {
    throw new Error('invalid_authorization');
  }
  return token.trim();
}

function requireAdminAuth(req, res) {
  try {
    const token = extractBearerToken(getAuthorizationHeader(req));
    if (!process.env.ADMIN_JWT_SECRET) {
      return res.status(500).json({ error: 'missing_jwt_secret' });
    }
    const payload = jwt.verify(token, process.env.ADMIN_JWT_SECRET);
    if (!payload || !payload.creator_user_id || !payload.role || !payload.email) {
      return res.status(401).json({ error: 'invalid_token' });
    }
    return {
      creator_user_id: payload.creator_user_id,
      role: payload.role,
      email: payload.email,
    };
  } catch (error) {
    return res.status(401).json({ error: 'unauthorized' });
  }
}

module.exports = { requireAdminAuth };
