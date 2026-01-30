const crypto = require('crypto');

class InstitutesAuthError extends Error {
  constructor({ error, message, status = 401, detail } = {}) {
    super(message || error || 'unauthorized');
    this.name = 'InstitutesAuthError';
    this.status = status;
    this.error = error || 'unauthorized';
    this.detail = detail;
  }
}

function createAuthError({ error, message, status, detail }) {
  return new InstitutesAuthError({ error, message, status, detail });
}

function base64UrlDecode(input) {
  if (!input || typeof input !== 'string') {
    throw createAuthError({
      error: 'invalid_token',
      message: 'Token segment is missing.',
    });
  }

  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');

  try {
    return Buffer.from(padded, 'base64').toString('utf8');
  } catch (error) {
    throw createAuthError({
      error: 'invalid_token',
      message: 'Unable to decode token segment.',
      detail: error.message,
    });
  }
}

function base64UrlEncode(input) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);

  return buffer.toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function extractBearerToken(authorizationHeader) {
  if (!authorizationHeader || typeof authorizationHeader !== 'string') {
    throw createAuthError({
      error: 'missing_authorization',
      message: 'Authorization header is required.',
    });
  }

  const [scheme, token] = authorizationHeader.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) {
    throw createAuthError({
      error: 'invalid_authorization',
      message: 'Authorization header must be a Bearer token.',
    });
  }

  return token.trim();
}

function verifySignature({ header, payload, signature, secret }) {
  const data = `${header}.${payload}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest();

  const expected = base64UrlEncode(expectedSignature);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    signatureBuffer.length !== expectedBuffer.length
    || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    throw createAuthError({
      error: 'invalid_signature',
      message: 'Token signature is invalid.',
    });
  }
}

function verifyInstitutesJwt(token, secret = process.env.INSTITUTES_JWT_SECRET) {
  if (!secret) {
    throw createAuthError({
      error: 'missing_jwt_secret',
      message: 'JWT secret is not configured.',
      status: 500,
    });
  }

  if (!token || typeof token !== 'string') {
    throw createAuthError({
      error: 'missing_token',
      message: 'JWT token is required.',
    });
  }

  const segments = token.split('.');
  if (segments.length !== 3) {
    throw createAuthError({
      error: 'invalid_token',
      message: 'JWT token format is invalid.',
    });
  }

  const [encodedHeader, encodedPayload, encodedSignature] = segments;
  const headerJson = base64UrlDecode(encodedHeader);
  const payloadJson = base64UrlDecode(encodedPayload);

  let header;
  let payload;

  try {
    header = JSON.parse(headerJson);
  } catch (error) {
    throw createAuthError({
      error: 'invalid_token',
      message: 'JWT header is invalid JSON.',
      detail: error.message,
    });
  }

  try {
    payload = JSON.parse(payloadJson);
  } catch (error) {
    throw createAuthError({
      error: 'invalid_token',
      message: 'JWT payload is invalid JSON.',
      detail: error.message,
    });
  }

  if (header.alg !== 'HS256') {
    throw createAuthError({
      error: 'unsupported_algorithm',
      message: 'JWT algorithm is not supported.',
    });
  }

  verifySignature({
    header: encodedHeader,
    payload: encodedPayload,
    signature: encodedSignature,
    secret,
  });

  if (payload.exp && Number.isFinite(payload.exp)) {
    const now = Math.floor(Date.now() / 1000);
    if (now >= payload.exp) {
      throw createAuthError({
        error: 'token_expired',
        message: 'JWT token has expired.',
      });
    }
  }

  const institutionId = payload.institution_id;
  const userId = payload.user_id;
  const role = payload.role;

  if (!institutionId || !userId || !role) {
    throw createAuthError({
      error: 'invalid_token',
      message: 'JWT token is missing required claims.',
    });
  }

  return {
    institution_id: institutionId,
    user_id: userId,
    role,
  };
}

function getAuthorizationHeader(req) {
  return req?.headers?.authorization || req?.headers?.Authorization || '';
}

function requireInstituteAuth(req, res) {
  try {
    const authorization = getAuthorizationHeader(req);
    const token = extractBearerToken(authorization);
    return verifyInstitutesJwt(token);
  } catch (error) {
    const status = error?.status && Number.isFinite(error.status) ? error.status : 401;
    const responseStatus = status === 500 ? 500 : 401;

    res.status(responseStatus).json({
      error: error?.error || 'unauthorized',
      message: error?.message || 'Authentication required.',
      detail: error?.detail,
    });

    return null;
  }
}

module.exports = {
  InstitutesAuthError,
  extractBearerToken,
  verifyInstitutesJwt,
  requireInstituteAuth,
};
