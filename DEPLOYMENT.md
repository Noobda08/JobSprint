# Deployment configuration

## Runtime feature flags

Shared runtime flags:

- `ENABLE_B2C_CORE` (default `true`)
- `ENABLE_B2C_GMAIL` (default `true`)
- `ENABLE_B2B_INSTITUTES` (default `false`)
- `ENABLE_B2B_ADMIN` (default `false`)

### Scope

- `ENABLE_B2C_CORE`: core B2C APIs (`/api/create-user`, `/api/get-user`, `/api/get-user-by-token`, `/api/create-order`, `/api/parse-resume`, `/api/applications`, `/api/delete-user`).
- `ENABLE_B2C_GMAIL`: Gmail integration APIs (`/api/gmail-*`).
- `ENABLE_B2B_INSTITUTES`: institutes APIs (`/api/institutes/*`).
- `ENABLE_B2B_ADMIN`: admin APIs (`/api/admin/*`).

Disabled flags return `404` with a feature-specific machine code.

## Environment alignment

Keep values aligned in:

1. Vercel project environment variables (`Production`, `Preview`, `Development`).
2. Any auxiliary runtime that calls these APIs.

## Production profile (B2C-only)

Set:

- `ENABLE_B2C_CORE=true`
- `ENABLE_B2C_GMAIL=true`
- `ENABLE_B2B_INSTITUTES=false`
- `ENABLE_B2B_ADMIN=false`
