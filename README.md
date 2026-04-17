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
| Auth     | NextAuth                          |
| Database | PostgreSQL · Prisma               |
| Cache    | Redis                             |
| Hosting  | Railway                           |
| CI/CD    | GitHub Actions · EAS Build        |

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
git clone https://github.com/yourname/fitapp.git
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
npx prisma db seed      # seeds exercises + default routines
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
├── app/                    # Expo Router screens
│   ├── (auth)/             # Unauthenticated screens
│   │   ├── sign-in.tsx
│   │   ├── sign-up.tsx
│   │   └── onboarding.tsx
│   ├── (tabs)/             # Main tab screens
│   │   ├── index.tsx       # Dashboard
│   │   ├── food.tsx        # Food log
│   │   ├── workout.tsx     # Workout tracker
│   │   └── profile.tsx     # Profile & settings
│   └── _layout.tsx         # Root layout + providers
├── components/             # Shared UI components
├── config/
│   └── gluestack.ts        # Theme tokens
├── hooks/                  # Custom React hooks
├── lib/
│   └── trpc.ts             # tRPC client
├── server/                 # Backend (Node.js + tRPC)
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   └── router.ts           # tRPC router
├── store/
│   └── auth.ts             # Zustand auth store
├── types/                  # Shared TypeScript types
├── .env.railway
├── app.json
├── babel.config.js
├── eas.json
├── tailwind.config.js
└── tsconfig.json
```

---

## GitHub Actions secrets required

Add these in Settings → Secrets → Actions:

| Secret                  | Description                       |
| ----------------------- | --------------------------------- |
| `DATABASE_URL_STAGING`  | Staging PostgreSQL URL            |
| `DATABASE_URL_PROD`     | Production PostgreSQL URL         |
| `RAILWAY_TOKEN_STAGING` | Railway deploy token (staging)    |
| `RAILWAY_TOKEN_PROD`    | Railway deploy token (production) |
| `SLACK_WEBHOOK_URL`     | Slack webhook for deploy alerts   |

---

## Roadmap

- [x] Phase 1 — Project scaffold & tooling
- [ ] Phase 2 — Backend & database setup
- [ ] Phase 3 — Auth & onboarding flow
- [ ] Phase 4 — Data seeding
- [ ] Phase 5 — CI/CD & environment config
