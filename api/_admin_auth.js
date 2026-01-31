const jwt = require('jsonwebtoken');

function getAuthorizationHeader(req) {
  return req?.headers?.authorization || req?.headers?.Authorization || '';
}

function extractBearerToken(authorizationHeader) {
  if (!authorizationHeader || typeof authorizationHeader !== 'string') {
    const error = new Error('Authorization header is required.');
    error.status = 401;
    error.code = 'missing_authorization';
    throw error;
  }

  const [scheme, token] = authorizationHeader.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) {
    const error = new Error('Authorization header must be a Bearer token.');
    error.status = 401;
    error.code = 'invalid_authorization';
    throw error;
  }

  return token.trim();
}

function requireAdminAuth(req, res) {
  try {
    if (!process.env.ADMIN_JWT_SECRET) {
      const error = new Error('JWT secret is not configured.');
      error.status = 500;
      error.code = 'missing_jwt_secret';
      throw error;
    }

    const authorization = getAuthorizationHeader(req);
    const token = extractBearerToken(authorization);
    const payload = jwt.verify(token, process.env.ADMIN_JWT_SECRET);

    const creatorUserId = payload?.creator_user_id;
    const role = payload?.role;
    const email = payload?.email;

    if (!creatorUserId || !role || !email) {
      const error = new Error('JWT token is missing required claims.');
      error.status = 401;
      error.code = 'invalid_token';
      throw error;
    }

    return {
      creator_user_id: creatorUserId,
      role,
      email,
    };
  } catch (error) {
    const status = error?.status && Number.isFinite(error.status) ? error.status : 401;

    res.status(status).json({
      error: error?.code || 'unauthorized',
      message: error?.message || 'Authentication required.',
    });

    return null;
  }
}

module.exports = { requireAdminAuth };
