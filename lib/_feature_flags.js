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

function isB2CCoreEnabled() {
  return parseBooleanEnv(process.env.ENABLE_B2C_CORE, true);
}

function isB2CGmailEnabled() {
  return parseBooleanEnv(process.env.ENABLE_B2C_GMAIL, true);
}

function isB2BInstitutesEnabled() {
  return parseBooleanEnv(process.env.ENABLE_B2B_INSTITUTES, false);
}

function isB2BAdminEnabled() {
  return parseBooleanEnv(process.env.ENABLE_B2B_ADMIN, false);
}

function respondB2CCoreDisabled(res) {
  return res.status(404).json({
    error: 'not_found',
    code: 'b2c_core_disabled',
    message: 'B2C core APIs are disabled.',
  });
}

function respondB2CGmailDisabled(res) {
  return res.status(404).json({
    error: 'not_found',
    code: 'b2c_gmail_disabled',
    message: 'B2C Gmail APIs are disabled.',
  });
}

function respondB2BInstitutesDisabled(res) {
  return res.status(404).json({
    error: 'not_found',
    code: 'b2b_institutes_disabled',
    message: 'B2B institutes APIs are disabled.',
  });
}

function respondB2BAdminDisabled(res) {
  return res.status(404).json({
    error: 'not_found',
    code: 'b2b_admin_disabled',
    message: 'B2B admin APIs are disabled.',
  });
}

module.exports = {
  isB2CCoreEnabled,
  isB2CGmailEnabled,
  isB2BInstitutesEnabled,
  isB2BAdminEnabled,
  respondB2CCoreDisabled,
  respondB2CGmailDisabled,
  respondB2BInstitutesDisabled,
  respondB2BAdminDisabled,
};
