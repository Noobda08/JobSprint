# JobSprint

## Feature-flag profiles

Shared flags (frontend convention via `window.JobSprintFeatureFlags`, backend via `process.env`):

- `ENABLE_B2C_CORE`
- `ENABLE_B2C_GMAIL`
- `ENABLE_B2B_INSTITUTES`
- `ENABLE_B2B_ADMIN`

### Expected values by environment

| Environment | ENABLE_B2C_CORE | ENABLE_B2C_GMAIL | ENABLE_B2B_INSTITUTES | ENABLE_B2B_ADMIN |
| --- | --- | --- | --- | --- |
| Production (B2C-only) | `true` | `true` | `false` | `false` |
| Preview / Staging (B2C-only default) | `true` | `true` | `false` | `false` |
| B2B testing environment | `true` | `true` | `true` | `true` |

## Smoke checklist (B2C-only profile)

1. Sign in from `/signup` (Google + payment flow if enabled).
2. Complete `/onboarding` and confirm profile save succeeds.
3. Continue to `/workspace` and confirm apps load + save works.
4. Verify B2B institutes path returns `404`:
   - `GET /api/institutes/me`
   - `POST /api/institutes/login`
   - `GET /api/institutes/placement-data`
5. Verify B2B admin path returns `404`:
   - `POST /api/admin/login`
