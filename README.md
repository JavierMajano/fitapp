# FitApp

A cross-platform fitness tracker for iOS, Android, and Web — workout logging, calorie tracking, and goal-based macro targets (bulk / maintenance / cut).

---

## Tech stack

| Layer    | Tech                              |
| -------- | --------------------------------- |
| Frontend | React Native · Expo · Expo Router |
| Styling  | NativeWind v4 · Gluestack UI v2   |
| State    | Zustand · React Query             |
| Backend  | Node.js · tRPC · Zod              |
| Auth     | Auth.js (`@auth/express`) · JWT   |
| Database | PostgreSQL · Prisma               |
| Cache    | Redis                             |
| Hosting  | Railway                           |
| CI/CD    | GitHub Actions · EAS Build        |
| Errors   | Sentry                            |

---

## Prerequisites

- Node.js 20+
- npm 10+
- [Expo CLI](https://docs.expo.dev/get-started/installation/) — `npm install -g expo-cli`
- [EAS CLI](https://docs.expo.dev/eas/) — `npm install -g eas-cli`
- PostgreSQL (local or Railway)
- Redis (local or Railway)

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/JavierMajano/fitapp.git
cd fitapp
npm install
```

### 2. Environment variables

See [docs/env-vars.md](docs/env-vars.md) for the full reference — descriptions, defaults, and where to obtain each value.

**Quick start (minimum for local dev):**

| Variable              | Where                                                                           |
| --------------------- | ------------------------------------------------------------------------------- |
| `DATABASE_URL`        | Local PostgreSQL or Railway public URL                                          |
| `JWT_SECRET`          | Run: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `REDIS_URL`           | Local Redis or Railway public URL                                               |
| `EXPO_PUBLIC_API_URL` | `http://localhost:3000` (default, no change needed)                             |

```bash
# Client env
cp .env.railway .env

# Server env
cp server/.env.railway server/.env
# Fill in {{placeholder}} values in both files
```

### 3. Set up the database

```bash
cd server
npm install
npx prisma migrate dev --name init
npx prisma db seed      # seeds muscles, exercises, routines, and dev user
```

### 4. Start the development server

```bash
# In one terminal — backend
cd server && npm run dev

# In another terminal — Expo app
npm start
```

Then press:

- `i` for iOS simulator
- `a` for Android emulator
- `w` for web browser

---

## Branch strategy

| Branch      | Purpose                            |
| ----------- | ---------------------------------- |
| `main`      | Production — auto-deploys to prod  |
| `dev`       | Staging — auto-deploys to staging  |
| `feature/*` | Feature branches — open PRs to dev |

### Workflow

```bash
git checkout dev
git pull
git checkout -b feature/your-feature-name

# ...make changes...

git add .
git commit -m "feat: describe your change"
git push origin feature/your-feature-name
# Open PR → dev on GitHub
```

---

## E2E Tests

Playwright suites run against the Expo web build + live backend.

```bash
# Legacy metric + imperial flows (no backend required — uses dev-bypass-token)
npm run test:e2e

# Full regression suite (requires backend running on port 3000)
node e2e/fitapp-regression.js

# Both suites + unified HTML report
npm run test:e2e:all
```

Results are written to `playwright-report/` (gitignored). Open `playwright-report/index.html` to view the full report with screenshots.

---

## EAS Builds

Native builds are managed via [EAS Build](https://docs.expo.dev/build/introduction/).

### Prerequisites

```bash
npm install -g eas-cli
eas login          # log in with your Expo account
eas whoami         # confirm you're in the fitappco org
```

### Build profiles

| Profile       | Purpose                                     | Distribution                       |
| ------------- | ------------------------------------------- | ---------------------------------- |
| `development` | Dev client with hot reload and dev menu     | Internal (iOS simulator)           |
| `preview`     | Internal test build pointing at staging API | Internal (TestFlight / direct APK) |
| `production`  | App Store / Play Store release              | Store                              |

### Running a development build

```bash
# Build dev client for both platforms
npm run eas:build:dev

# iOS simulator only (faster)
eas build --profile development --platform ios

# Install on simulator after build completes
eas build:run -p ios
```

### Sentry DSN for builds

`EXPO_PUBLIC_SENTRY_DSN` in `eas.json` is intentionally empty — Sentry is disabled in development and preview builds by default. Set the real DSN as an EAS Secret so it is injected at build time without being committed:

```bash
eas secret:create --scope project --name EXPO_PUBLIC_SENTRY_DSN --value "https://..."
```

---

## Project structure

```
fitapp/
├── app/
│   ├── (auth)/
│   │   ├── sign-in.tsx         # Email/password + Google SSO
│   │   ├── sign-up.tsx
│   │   └── onboarding.tsx      # 5-step wizard (measurements → TDEE preview)
│   ├── (tabs)/
│   │   ├── index.tsx           # Dashboard — macro ring + goal weight widget
│   │   ├── food.tsx            # Food log + search + barcode scanner
│   │   ├── workout.tsx         # Workout tracker + routines + set logging
│   │   ├── progress.tsx        # Body weight + calorie charts
│   │   └── profile.tsx         # Profile & settings
│   └── _layout.tsx             # Root layout + AuthGuard + providers
├── components/
│   ├── BarcodeScanner.tsx      # Camera-based barcode scanner (expo-camera)
│   ├── DateNav.tsx             # Prev/next day navigation bar
│   └── ErrorToast.tsx          # Global tRPC error toast overlay
├── config/
│   └── gluestack.ts            # Theme tokens (colors, spacing, radii)
├── docs/
│   └── env-vars.md             # Full env var reference table
├── e2e/
│   ├── fitapp-kg.js            # Metric flow — 30 tests (Desktop + iPhone 14)
│   ├── fitapp-lbs.js           # Imperial flow — 24 tests
│   ├── fitapp-regression.js    # Full regression — 130 tests (real backend JWT)
│   ├── run-all.js              # Cross-platform test runner (Windows-safe)
│   └── report.js               # Unified HTML report generator
├── lib/
│   ├── trpc.ts                 # tRPC client with Bearer token injection
│   └── units.ts                # kg↔lbs / cm↔in conversion utilities
├── server/
│   ├── prisma/
│   │   ├── schema.prisma       # Full PostgreSQL schema (all tables)
│   │   ├── seed.ts             # Seeds exercises, routines, and dev user
│   │   └── migrations/
│   └── src/
│       ├── router.ts           # tRPC router — all procedures
│       ├── context.ts          # Request context (JWT + Auth.js session)
│       ├── services/           # auth, food, workout, body, progress, user
│       ├── schemas/            # Shared Zod schemas
│       └── __tests__/         # 208 Vitest unit + integration tests
├── store/
│   ├── auth.ts                 # Zustand auth store (token + user)
│   ├── toast.ts                # Toast notification store
│   └── units.ts                # Unit system preference (metric/imperial)
├── app.json
├── eas.json
├── tailwind.config.js
└── tsconfig.json
```

---

## GitHub Actions secrets required

Add these in Settings → Secrets → Actions:

| Secret                  | Description                                           |
| ----------------------- | ----------------------------------------------------- |
| `DATABASE_URL_STAGING`  | Staging PostgreSQL URL (deploy workflow)              |
| `DATABASE_URL_PROD`     | Production PostgreSQL URL (deploy workflow)           |
| `RAILWAY_TOKEN_STAGING` | Railway deploy token — staging                        |
| `RAILWAY_TOKEN_PROD`    | Railway deploy token — production                     |
| `RAILWAY_DATABASE_URL`  | PostgreSQL URL for `playwright-regression` CI job     |
| `JWT_SECRET`            | JWT signing secret for `playwright-regression` CI job |
| `REDIS_URL`             | Redis URL for `playwright-regression` CI job          |

---

## Roadmap

- [x] Phase 1 — Project scaffold & tooling
- [x] Phase 2 — Backend & database setup
- [x] Phase 3 — Auth & onboarding flow
- [x] Phase 4 — Data seeding & food/workout APIs
- [x] Phase 5 — CI/CD & environment config
- [x] Phase 6 — Wire all UI tabs to real tRPC/DB backend
