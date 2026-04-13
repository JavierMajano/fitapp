# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm start             # Start Expo dev server (iOS/Android/Web)
npm run android       # Run on Android
npm run ios           # Run on iOS
npm run web           # Run in browser

# Code Quality
npm run lint          # ESLint (zero warnings allowed)
npm run typecheck     # TypeScript type-check (no emit)
npm run format        # Prettier format all files
```

Pre-commit hooks run `lint-staged` (format + lint staged files). Pre-push runs `typecheck`.

## Architecture

FitApp is a React Native fitness tracker (Expo 51 / React Native 0.74) in **Phase 1** — scaffold complete, backend not yet implemented.

### Tech Stack

| Layer        | Technology                                     |
| ------------ | ---------------------------------------------- |
| Mobile app   | Expo + Expo Router 3.5 (file-based routing)    |
| Styling      | NativeWind v4 + Gluestack UI v2 + TailwindCSS  |
| Client state | Zustand (auth store at `/store/auth.ts`)       |
| Server state | React Query 5                                  |
| API layer    | tRPC 11 (`/server/router.ts` → `/lib/trpc.ts`) |
| Database     | PostgreSQL + Prisma (planned, Phase 2)         |
| Cache        | Redis (planned)                                |

### App Routing (`/app` — Expo Router)

```
_layout.tsx          # Root: QueryClientProvider + GluestackUIProvider
(auth)/              # Auth stack: sign-in, sign-up, onboarding
(tabs)/              # Authenticated area
  _layout.tsx        # Tab bar with 4 tabs
  index.tsx          # Dashboard (macro ring placeholder)
  food.tsx           # Food logging with meal breakdown
  workout.tsx        # Workout tracking with routine selector
  profile.tsx        # User profile & settings
```

### tRPC Router (`/server/router.ts`)

All procedures are scaffolded but not implemented. The router shape:

- `health` — liveness check
- `auth` — `signUp`, `signIn`, `me`
- `user` — `updateProfile`, `completeOnboard` (goal, weight, height, age, sex, activityLevel)
- `food` — `search` (USDA/Open Food Facts), `byBarcode`, `logEntry`
- `workout` — `listRoutines`, `startSession`, `logSet`, `endSession`

The tRPC client (`/lib/trpc.ts`) uses `httpBatchLink` pointed at `EXPO_PUBLIC_API_URL` (default: `http://localhost:3000`). Auth token injection is stubbed.

### State Management

Zustand auth store (`/store/auth.ts`) holds `user`, `token`, `isLoading`, `isOnboarded`. React Query handles all server state with 5 min `staleTime`.

### Styling Conventions

- Dark-first design: backgrounds use `surface.*` tokens (`#0f0f0f`–`#2e2e2e`)
- Brand green: `#1a9e6e`
- Goal mode colors: bulk=amber, cut=red, maintenance=blue
- Macro colors: protein=purple, carbs=orange, fat=yellow
- Tailwind config at `/tailwind.config.js`; Gluestack tokens at `/config/gluestack.ts`

### Path Aliases (tsconfig)

`@/*` → root, `@components/*`, `@lib/*`, `@store/*`, `@types/*`, `@config/*`

### CI/CD

- `dev` branch → staging (Railway), `main` → production
- `.github/workflows/ci.yml`: lint + typecheck + expo-doctor on PRs
- `.github/workflows/deploy.yml`: Railway deploy + Prisma migrations on push to dev/main

### Environment

Copy `.env.railway` to `.env`. Key variable: `EXPO_PUBLIC_API_URL`.
