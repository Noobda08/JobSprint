# Deployment configuration

## Runtime feature flags

### `ENABLE_B2B_ADMIN`

- **Default:** `false`
- **Scope:** All `api/admin/*` handlers.
- **Behavior when `false`:** Admin APIs return `404` with machine-readable code `b2b_admin_disabled` and skip admin/institute table reads in those handlers.
- **Behavior when `true`:** Admin APIs run normally.

## Environment alignment

To keep environments consistent, set the same `ENABLE_B2B_ADMIN` value in each deployment target:

1. **Vercel project environment variables** (`Production`, `Preview`, and `Development`).
2. **Supabase-managed runtimes** (only if you have Supabase Edge Functions or jobs that call these admin APIs and rely on matching feature behavior).

## Suggested values by surface

- B2C-only environments: `ENABLE_B2B_ADMIN=false`
- B2B admin-enabled environments: `ENABLE_B2B_ADMIN=true`
