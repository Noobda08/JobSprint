(function bootstrapFeatureFlags(globalScope) {
  const defaults = Object.freeze({
    ENABLE_B2C_CORE: true,
    ENABLE_B2C_GMAIL: true,
    ENABLE_B2B_INSTITUTES: false,
    ENABLE_B2B_ADMIN: false,
  });

  function normalizeFlag(value, fallback) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
      if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
    }
    return fallback;
  }

  function loadOverrides() {
    try {
      const raw = globalScope.localStorage?.getItem('jobsprint_feature_flags');
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  const serverInjected = globalScope.__JOBSPRINT_FLAGS__ || {};
  const localOverrides = loadOverrides();

  const featureFlags = {
    ENABLE_B2C_CORE: normalizeFlag(serverInjected.ENABLE_B2C_CORE ?? localOverrides.ENABLE_B2C_CORE, defaults.ENABLE_B2C_CORE),
    ENABLE_B2C_GMAIL: normalizeFlag(serverInjected.ENABLE_B2C_GMAIL ?? localOverrides.ENABLE_B2C_GMAIL, defaults.ENABLE_B2C_GMAIL),
    ENABLE_B2B_INSTITUTES: normalizeFlag(serverInjected.ENABLE_B2B_INSTITUTES ?? localOverrides.ENABLE_B2B_INSTITUTES, defaults.ENABLE_B2B_INSTITUTES),
    ENABLE_B2B_ADMIN: normalizeFlag(serverInjected.ENABLE_B2B_ADMIN ?? localOverrides.ENABLE_B2B_ADMIN, defaults.ENABLE_B2B_ADMIN),
  };

  globalScope.JobSprintFeatureFlags = Object.freeze(featureFlags);
})(window);
