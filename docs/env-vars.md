# Environment Variables Reference

Copy the templates to get started:

```bash
cp .env.railway .env
cp server/.env.railway server/.env
# Fill in all {{placeholder}} values
```

---

## Client Variables (`EXPO_PUBLIC_*`)

Bundled into the app at build time — safe to expose, but do not put secrets here.

| Variable                           | Required | Default                 | Description                           | Where to get                                            |
| ---------------------------------- | -------- | ----------------------- | ------------------------------------- | ------------------------------------------------------- |
| `EXPO_PUBLIC_API_URL`              | Yes      | `http://localhost:3000` | tRPC server base URL                  | Set manually per environment                            |
| `EXPO_PUBLIC_APP_ENV`              | Yes      | `development`           | Environment label (used by Sentry)    | `development` / `staging` / `production`                |
| `EXPO_PUBLIC_SENTRY_DSN`           | No       | —                       | Sentry DSN for mobile crash reporting | Sentry → `fitapp-expo` project → Settings → Client Keys |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | No       | —                       | Google OAuth web client ID            | Google Cloud Console → Credentials → OAuth 2.0          |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | No       | —                       | Google OAuth iOS client ID            | Google Cloud Console → Credentials → OAuth 2.0          |

> **EAS Builds:** Set `EXPO_PUBLIC_SENTRY_DSN` as an EAS Secret so it is injected at build time without being committed to the repo:
>
> ```bash
> eas secret:create --scope project --name EXPO_PUBLIC_SENTRY_DSN --value "https://..."
> ```

---

## Server Variables (`server/.env`)

Never prefix these with `EXPO_PUBLIC_` — they must stay server-side only.

### Required

| Variable       | Description                         | How to generate                                                            |
| -------------- | ----------------------------------- | -------------------------------------------------------------------------- |
| `DATABASE_URL` | PostgreSQL connection URL           | Railway → PostgreSQL service → Connect → Public URL                        |
| `JWT_SECRET`   | 64-char hex secret for signing JWTs | `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `REDIS_URL`    | Redis connection URL                | Railway → Redis service → Connect → Public URL                             |

### Optional (with defaults)

| Variable   | Default       | Description                                        |
| ---------- | ------------- | -------------------------------------------------- |
| `PORT`     | `3000`        | HTTP server port (Railway sets this automatically) |
| `NODE_ENV` | `development` | Node environment — set to `production` in Railway  |

### Optional features

| Variable               | Description                                 | Where to get                                                               |
| ---------------------- | ------------------------------------------- | -------------------------------------------------------------------------- |
| `USDA_API_KEY`         | USDA FoodData Central API key (food search) | [fdc.nal.usda.gov/api-key-signup](https://fdc.nal.usda.gov/api-key-signup) |
| `GOOGLE_CLIENT_ID`     | Google OAuth web client ID                  | Google Cloud Console → Credentials                                         |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret                  | Google Cloud Console → Credentials                                         |
| `APPLE_ID`             | Apple bundle ID for Sign In with Apple      | App Store Connect → Certificates, Identifiers & Profiles                   |
| `APPLE_SECRET`         | Apple private key (P8 file contents)        | App Store Connect → Keys                                                   |
| `SENTRY_DSN`           | Sentry DSN for server error tracking        | Sentry → `fitapp-server` project → Settings → Client Keys                  |

---

## Railway-injected Variables

Set automatically by Railway at deploy time — **do not set these manually in local `.env`**.

| Variable                | Description                                                          |
| ----------------------- | -------------------------------------------------------------------- |
| `DATABASE_URL_INTERNAL` | Internal Railway network URL for PostgreSQL (faster, no egress cost) |
| `REDIS_URL_INTERNAL`    | Internal Railway network URL for Redis (faster, no egress cost)      |

---

## GitHub Actions Secrets

Required in repository Settings → Secrets and variables → Actions:

| Secret                  | Description                                         |
| ----------------------- | --------------------------------------------------- |
| `RAILWAY_TOKEN_STAGING` | Railway deploy token for the staging environment    |
| `RAILWAY_TOKEN_PROD`    | Railway deploy token for the production environment |
| `DATABASE_URL_STAGING`  | PostgreSQL URL for running migrations on deploy     |
| `DATABASE_URL_PROD`     | PostgreSQL URL for running migrations on deploy     |
