function parseBooleanEnv(value, defaultValue = false) {
  if (typeof value !== 'string') {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return defaultValue;
  }

  return ['1', 'true', 'yes', 'on'].includes(normalized);
}

function isB2BAdminEnabled() {
  return parseBooleanEnv(process.env.ENABLE_B2B_ADMIN, false);
}

function respondB2BAdminDisabled(res) {
  return res.status(404).json({
    error: 'not_found',
    code: 'b2b_admin_disabled',
    message: 'B2B admin APIs are disabled.',
  });
}

module.exports = {
  isB2BAdminEnabled,
  respondB2BAdminDisabled,
};
