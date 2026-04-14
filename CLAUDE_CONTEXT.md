# FitApp — Full Project Context

This document contains everything needed to continue building FitApp.
Paste this into Claude Code at the start of a session to get fully up to speed.

---

## What this app is

A cross-platform fitness tracker (iOS, Android, Web) with two core features:

1. **Workout tracker** — log sessions, sets, reps, weight. Build and follow routines.
2. **Calorie + macro tracker** — log food, scan barcodes, track against daily targets.

Users set a goal mode — **bulking**, **maintenance**, or **cutting** — which drives their
calorie target and macro split. TDEE is calculated from their profile and adjusts weekly
based on weigh-ins.

---

## Tech stack

| Layer       | Technology                                       |
| ----------- | ------------------------------------------------ |
| Frontend    | React Native, Expo ~51, Expo Router ~3.5         |
| Styling     | NativeWind v4 (Tailwind for RN), Gluestack UI v2 |
| Charts      | Victory Native XL + @shopify/react-native-skia   |
| State       | Zustand (local), React Query (server)            |
| API         | tRPC v11 (end-to-end type-safe)                  |
| Validation  | Zod                                              |
| Auth        | NextAuth (email+password, Google, Apple)         |
| Database    | PostgreSQL via Prisma ORM                        |
| Cache       | Redis (ioredis)                                  |
| Background  | BullMQ (weekly TDEE recalc jobs)                 |
| Hosting     | Railway (backend + DB + Redis)                   |
| CI/CD       | GitHub Actions + Expo EAS Build                  |
| Errors      | Sentry                                           |
| Push notifs | Expo Push Notifications                          |

---

## GitHub repo

https://github.com/JavierMajano/fitapp

Branch strategy:

- `main` — production, auto-deploys to Railway prod
- `dev` — staging, auto-deploys to Railway staging
- `feature/*` — all work happens here, PRs opened against dev

---

## Food APIs

- **Primary**: Open Food Facts — barcode lookup
  `GET https://world.openfoodfacts.org/api/v0/product/{barcode}.json`
- **Fallback**: USDA FoodData Central — text search for unbranded/generic foods
  `GET https://api.nal.usda.gov/fdc/v1/foods/search?query={term}&api_key={key}`
- **Strategy**: try Open Food Facts first → USDA fallback → custom entry
- **Barcode scanning**: `expo-camera` with `CameraView` component, types `ean13` + `upc_a`
- **Cache**: Redis with 24hr TTL on all food API responses

---

## Exercise library

- Seeded from **wger.de REST API** (~800 exercises with muscle groups)
- Stored in `EXERCISE` and `MUSCLE` tables
- `EXERCISE_MUSCLE` junction table with `role` field (primary / secondary)

---

## Styling decisions

- **Dark-first design** — surface background `#0f0f0f`
- **Brand color** — green (`#1a9e6e` primary)
- **Goal colors**: bulk = amber `#f59e0b`, cut = red `#ef4444`, maintenance = blue `#3b82f6`
- **Macro colors**: protein = purple `#a78bfa`, carbs = orange `#fb923c`, fat = yellow `#facc15`
- NativeWind utility classes used for layout/spacing
- Gluestack UI v2 used for interactive components (Button, Input, Modal, Progress, etc.)

---

## Progress tracking decisions

- **MVP level**: Standard — weight chart, calorie chart, strength per exercise
- **Past entries**: Fully editable (food log entries and workout sets)
- **Chart library**: Victory Native XL + @shopify/react-native-skia
  - Install: `npm install victory-native@^41 @shopify/react-native-skia`
- **Navigation**: 5 tabs — Dashboard, Food, Workout, Progress, Profile
- **Date navigation**: Prev/next day arrows on Food and Workout screens from day one
- **Time ranges on charts**: 1W, 1M, 3M, 6M, All

### Progress tab sections

1. Body weight chart — line chart from BODY_LOG, selectable time range
2. Calorie chart — bar chart of daily calories vs target from FOOD_LOG
3. Strength tracker — select any exercise, plot max weight per session from SESSION_SET

---

## Full L3 database schema

### USER

```
id uuid PK
email string
password_hash string
name string
avatar_url string
goal_mode string          -- 'bulk' | 'maintenance' | 'cut'
weight_kg float
height_cm float
age int
sex string                -- 'male' | 'female'
activity_level string     -- 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
tdee_calories int
calorie_target int
protein_target_g int
carbs_target_g int
fat_target_g int
created_at timestamp
updated_at timestamp
```

### USER_SETTINGS

```
id uuid PK
user_id uuid FK → USER
unit_system string        -- 'metric' | 'imperial'
theme string
weekly_weigh_in_day int   -- 0=Sun ... 6=Sat
default_rest_seconds int
notification_reminders int
timezone string
```

### BODY_LOG

```
id uuid PK
user_id uuid FK → USER
weight_kg float
body_fat_pct float
muscle_mass_kg float
notes string
photo_url string
logged_date date
```

### GOAL_HISTORY

```
id uuid PK
user_id uuid FK → USER
goal_mode string
calorie_target int
protein_target_g int
carbs_target_g int
fat_target_g int
started_at date
ended_at date
```

### ROUTINE

```
id uuid PK
user_id uuid FK → USER   -- null = system routine
name string
description string
days_per_week int
is_active int             -- 0 | 1
created_at timestamp
```

### ROUTINE_DAY

```
id uuid PK
routine_id uuid FK → ROUTINE
day_index int
label string              -- e.g. 'Push', 'Pull', 'Legs'
```

### ROUTINE_EXERCISE

```
id uuid PK
routine_day_id uuid FK → ROUTINE_DAY
exercise_id uuid FK → EXERCISE
order_index int
sets int
reps int
weight_kg float
rest_seconds int
notes string
```

### EXERCISE

```
id uuid PK
name string
category string           -- e.g. 'strength' | 'cardio' | 'flexibility'
equipment string
movement_type string      -- e.g. 'push' | 'pull' | 'hinge' | 'squat'
difficulty string
instructions string
video_url string
source string             -- 'wger' | 'custom'
source_ref_id string
```

### EXERCISE_MUSCLE

```
id uuid PK
exercise_id uuid FK → EXERCISE
muscle_id uuid FK → MUSCLE
role string               -- 'primary' | 'secondary'
```

### MUSCLE

```
id uuid PK
name string
group string              -- e.g. 'chest' | 'back' | 'legs'
body_region string        -- 'upper' | 'lower' | 'core'
```

### WORKOUT_SESSION

```
id uuid PK
user_id uuid FK → USER
routine_id uuid FK → ROUTINE (nullable)
routine_day_id uuid FK → ROUTINE_DAY (nullable)
name string
notes string
perceived_effort int      -- 1–10 RPE scale
calories_burned int
started_at timestamp
ended_at timestamp
```

### SESSION_SET

```
id uuid PK
session_id uuid FK → WORKOUT_SESSION
exercise_id uuid FK → EXERCISE
set_number int
set_type string           -- 'warmup' | 'working' | 'drop'
weight_kg float
reps int
duration_seconds int      -- for timed exercises (planks etc.)
distance_km float         -- for distance exercises (sled push etc.)
completed int             -- 0 | 1
logged_at timestamp
edited_at timestamp       -- updated when a past entry is edited
```

### CARDIO_SESSION

```
id uuid PK
user_id uuid FK → USER
activity_type string      -- 'run' | 'cycle' | 'row' | 'swim' etc.
duration_minutes int
distance_km float
calories_burned int
avg_heart_rate int
notes string
logged_at timestamp
```

### FOOD_ITEM

```
id uuid PK
user_id uuid FK → USER (nullable — null = shared/API item)
name string
brand string
barcode string
source string             -- 'open_food_facts' | 'usda' | 'custom'
source_ref_id string
calories_per_100g int
protein_per_100g float
carbs_per_100g float
fat_per_100g float
fiber_per_100g float
sugar_per_100g float
sodium_per_100g float
is_verified int           -- 0 | 1
```

### FOOD_SERVING

```
id uuid PK
food_item_id uuid FK → FOOD_ITEM
label string              -- e.g. '1 slice', '1 cup', '1 tbsp'
grams float
```

### FOOD_LOG

```
id uuid PK
user_id uuid FK → USER
log_date date
total_calories int
total_protein_g float
total_carbs_g float
total_fat_g float
total_fiber_g float
```

### FOOD_LOG_ENTRY

```
id uuid PK
food_log_id uuid FK → FOOD_LOG
food_item_id uuid FK → FOOD_ITEM
food_serving_id uuid FK → FOOD_SERVING (nullable)
meal_type string          -- 'breakfast' | 'lunch' | 'dinner' | 'snacks'
quantity_grams float
calories int              -- stored at time of logging
protein_g float
carbs_g float
fat_g float
fiber_g float
logged_at timestamp
edited_at timestamp       -- updated when a past entry is edited
```

### WATER_LOG

```
id uuid PK
user_id uuid FK → USER
amount_ml float
log_date date
logged_at timestamp
```

---

## TDEE calculation logic (Phase 3)

```
BMR (Mifflin-St Jeor):
  Male:   BMR = (10 × weight_kg) + (6.25 × height_cm) - (5 × age) + 5
  Female: BMR = (10 × weight_kg) + (6.25 × height_cm) - (5 × age) - 161

Activity multiplier:
  sedentary   → × 1.2
  light       → × 1.375
  moderate    → × 1.55
  active      → × 1.725
  very_active → × 1.9

TDEE = BMR × activity_multiplier

Goal adjustment:
  bulk        → calorie_target = TDEE + 400
  maintenance → calorie_target = TDEE
  cut         → calorie_target = TDEE - 400

Macro split (starting point):
  protein = weight_kg × 2               (grams)
  fat     = calorie_target × 0.25 / 9   (grams)
  carbs   = (calorie_target - protein×4 - fat×9) / 4  (grams)
```

---

## Project structure (Phase 3 — current state)

```
fitapp/
├── app/
│   ├── (auth)/
│   │   ├── _layout.tsx       -- auth stack navigator
│   │   ├── sign-in.tsx       -- email/password + Google SSO + Apple SSO (iOS)
│   │   ├── sign-up.tsx       -- email/password + Google SSO + Apple SSO (iOS)
│   │   └── onboarding.tsx    -- 5-step wizard: name → measurements → goal → activity → TDEE preview
│   ├── (tabs)/
│   │   ├── _layout.tsx       -- bottom tab navigator + custom icons (5 tabs)
│   │   ├── index.tsx         -- dashboard (placeholder)
│   │   ├── food.tsx          -- food log with DateNav component
│   │   ├── workout.tsx       -- workout with DateNav component
│   │   ├── progress.tsx      -- progress charts (placeholder)
│   │   └── profile.tsx       -- profile (placeholder)
│   └── _layout.tsx           -- root layout + AuthGuard (protected routes) + hydrate()
├── components/
│   └── DateNav.tsx           -- reusable prev/next day navigation bar
├── config/
│   └── gluestack.ts          -- full token config (colors, spacing, radii, fonts)
├── lib/
│   ├── trpc.ts               -- tRPC client with Bearer token injection
│   └── units.ts              -- unit conversion utilities (kg↔lbs, cm↔in, toMetric*, bounds)
├── server/
│   ├── prisma/
│   │   ├── schema.prisma     -- full L3 schema (all tables)
│   │   └── seed.ts           -- seed stub (Phase 4 adds exercise library)
│   └── src/
│       ├── auth.ts           -- Auth.js config (Google + Apple providers)
│       ├── context.ts        -- tRPC context: JWT Bearer + Auth.js cookie session
│       ├── db.ts             -- Prisma client singleton
│       ├── index.ts          -- Express server (tRPC + Auth.js routes + health)
│       ├── redis.ts          -- ioredis client singleton
│       ├── router.ts         -- tRPC router: auth, user, food, workout procedures
│       ├── schemas.ts        -- Zod schemas (signUp, signIn, onboarding)
│       └── services/
│           ├── auth.service.ts    -- signUp, signIn, getSafeUser (JWT-based)
│           ├── social.service.ts  -- googleSignIn, appleSignIn (token verification + find-or-create)
│           └── user.service.ts    -- completeOnboard + TDEE/macro calculation
├── store/
│   └── auth.ts               -- Zustand auth store with expo-secure-store persistence
├── global.css                -- NativeWind v4 required CSS entry point
├── metro.config.js           -- NativeWind withNativeWind wrapper
├── .env.example              -- all required env vars documented
├── .eslintrc.js              -- eslint-config-expo + prettier + import order
├── .prettierrc               -- prettier + tailwind class sorter
├── .husky/
│   ├── pre-commit            -- runs lint-staged
│   └── pre-push              -- runs typecheck
├── .github/
│   └── workflows/
│       ├── ci.yml            -- PR: lint + typecheck + expo-doctor
│       └── deploy.yml        -- push dev→staging, main→production on Railway
├── app.json                  -- Expo config (bundleIdentifier needs updating)
├── babel.config.js           -- NativeWind + Reanimated plugins
├── eas.json                  -- EAS build profiles: dev, preview, production
├── package.json              -- all dependencies
├── tailwind.config.js        -- darkMode: 'class' + custom theme tokens
├── tsconfig.json             -- strict mode + path aliases (excludes server/)
└── README.md                 -- setup guide + branch strategy
```

---

## Known issues and fixes applied

### 1. npm peer dependency conflict

`@gluestack-ui/themed` pulls in `react-dom@19` but Expo 51 uses React 18.
Fixed in `package.json` with:

```json
"overrides": { "react": "18.2.0", "react-dom": "18.2.0" }
```

If conflict persists: `npm install --legacy-peer-deps`

### 2. Missing @react-native-aria packages

Gluestack needs these installed explicitly:

```bash
npm install @react-native-aria/overlays @react-native-aria/interactions @react-native-aria/focus @react-native-aria/button @react-native-aria/checkbox @react-native-aria/radio @react-native-aria/toggle @react-native-aria/slider @react-native-aria/utils
```

### 3. NativeWind + Gluestack dark mode conflict

Error: "Cannot manually set color scheme, as dark mode is type 'media'"
Fixed by:

- `darkMode: 'class'` in `tailwind.config.js`
- `global.css` with Tailwind directives imported as first line of `app/_layout.tsx`
- `metro.config.js` using `withNativeWind(config, { input: './global.css' })`

### 4. Windows Metro cache issues

Always restart with: `npx expo start --clear`

### 5. lightningcss native binary missing on 32-bit Windows (win32-ia32)

lightningcss 1.19–1.27 ships no ia32 Windows binary. Both copies
(`node_modules/lightningcss/node/index.js` and
`node_modules/react-native-css-interop/node_modules/lightningcss/node/index.js`)
need a third catch fallback to the WASM build:

```bash
npm install lightningcss-wasm@1.27.0
```

Then patch both `index.js` files — add a third catch after the existing two:
```js
} catch (err2) { module.exports = require('lightningcss-wasm'); }
```

### 6. Prisma binary engine required on 32-bit Node

Add to `server/prisma/schema.prisma` generator block:
```prisma
engineType = "binary"
```

Set env vars when running Prisma CLI:
```bash
PRISMA_CLI_QUERY_ENGINE_TYPE=binary PRISMA_CLIENT_ENGINE_TYPE=binary npx prisma generate
```

### 7. expo-secure-store is native-only (no web support)

`expo-secure-store` throws on web. `store/auth.ts` uses a `Platform.OS === 'web'`
check to fall back to `localStorage` for all `getItem`/`setItem`/`deleteItem` calls.

---

## Foundation plan — 6 phases

### Phase 1 — Project scaffold & tooling ✅ COMPLETE

- Expo project with TypeScript
- NativeWind v4 + global.css + metro.config.js configured
- Gluestack UI v2 + all @react-native-aria packages
- Expo Router with (tabs) and (auth) groups — 5 tabs
- ESLint + Prettier + Husky
- GitHub repo + branch strategy
- GitHub Actions CI/CD pipelines
- EAS build config

### Phase 2 — Backend & database setup ✅ COMPLETE

- Full Prisma schema (`server/prisma/schema.prisma`) — all L3 tables including edited_at fields
- Node.js + Express + tRPC v11 server (`server/src/`)
- JWT-based auth via `jsonwebtoken` (30-day tokens, Bearer header on mobile)
- Auth.js (`@auth/express`) configured for Google OAuth provider (cookie sessions for web)
- Dual session resolution in tRPC context: Bearer JWT → Auth.js cookie fallback
- Redis client via ioredis (`server/src/redis.ts`)
- 110 unit tests passing (Vitest) covering schemas, services, and router procedures
- Server deployed to Railway staging (via `dev` branch CI/CD)

### Phase 3 — Auth & onboarding flow ✅ CODE COMPLETE — deployment steps remaining

#### What's built

- **Sign-in screen** (`app/(auth)/sign-in.tsx`) — email/password + Google SSO
- **Sign-up screen** (`app/(auth)/sign-up.tsx`) — email/password + Google SSO
- **Onboarding wizard** (`app/(auth)/onboarding.tsx`) — 5 steps:
  - Step 0: Name (pre-filled from sign-up)
  - Step 1: Unit system dropdown (metric/imperial, auto-converts on toggle), Weight, Height, Age, Sex
  - Step 2: Goal mode cards — bulk (amber), maintenance (blue), cut (red)
  - Step 3: Activity level — 5 option cards
  - Step 4: TDEE preview — calorie target + protein/carbs/fat breakdown chips
- **TDEE calculation** (`server/src/services/user.service.ts`) — Mifflin-St Jeor BMR × activity multiplier + goal adjustment + macro split
- **Auth store** (`store/auth.ts`) — Zustand with `expo-secure-store` persistence; hydrates JWT on app launch
- **AuthGuard** (`app/_layout.tsx`) — protects routes; redirects unauthenticated → sign-in, onboarding-incomplete → onboarding, authenticated → tabs
- **DateNav component** (`components/DateNav.tsx`) — prev/next day bar; wired into Food + Workout tabs
- **Google SSO** — client: `expo-auth-session`; server: `google-auth-library` token verification → find-or-create user by email
- tRPC procedures: `auth.signUp`, `auth.signIn`, `auth.me`, `auth.googleSignIn`, `user.completeOnboard`
- Apple Sign In **intentionally skipped** — requires Apple Developer Program ($99/year); can be added later
- **Unit system dropdown** (`lib/units.ts` + `onboarding.tsx`) — metric/imperial toggle on the measurements step; fields auto-convert on switch; server always receives kg/cm
- **Auth store web compat** (`store/auth.ts`) — `Platform.OS === 'web'` check; uses `localStorage` on web, `expo-secure-store` on native
- **Auth + onboarding flow tests** (`server/src/__tests__/flows/auth-onboarding.flow.test.ts`) — 5 Vitest flow tests covering the full signUp → signIn → completeOnboard path and all error branches; 112 tests total across 6 files

#### Remaining steps to finish Phase 3

- [x] Google OAuth credentials created (Google Cloud Console) — web + iOS client IDs in hand
- [x] **Add credentials to `.env`** locally:
  ```
  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<your-web-client-id>
  EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=<your-ios-client-id>
  GOOGLE_CLIENT_ID=<your-web-client-id>   # used server-side to verify tokens
  JWT_SECRET=<random-secret>
  DATABASE_URL=<railway-postgres-url>
  REDIS_URL=<railway-redis-url>
  ```
- [x] **Add the same vars to Railway** (staging service environment) — Settings → Variables
- [x] **Run Prisma migration** on Railway staging:
  ```bash
  cd server && npx prisma migrate deploy
  ```
- [ ] **Merge feature branch → dev** — open PR from `feature/phase-3-auth-onboarding` → `dev`, let CI pass, merge
- [ ] **Test end-to-end** — sign up with email, complete onboarding, sign out, sign in with Google

### Phase 4 — Data seeding (NEXT)

- Import exercise library from wger.de into EXERCISE + MUSCLE tables
- Wire up Open Food Facts + USDA food API wrappers
- Seed 3 default routines: PPL (6-day), Upper/Lower (4-day), Full Body (3-day)

### Phase 5 — CI/CD & environment config

- GitHub Actions pipelines (scaffolded — needs secrets added)
- Sentry error tracking
- Expo EAS Build dev profile
- Document all env vars

### Phase 6 — Progress & history

- Install: `npm install victory-native@^41 @shopify/react-native-skia`
- Progress tab with 3 sections:
  1. Body weight line chart (BODY_LOG) — time range selector: 1W/1M/3M/6M/All
  2. Calorie bar chart — daily intake vs target (FOOD_LOG)
  3. Strength tracker — exercise picker + max weight per session (SESSION_SET)
- Date navigation on Food screen — view and edit any past day
- Date navigation on Workout screen — view and edit any past session
- Edit mode for FOOD_LOG_ENTRY — updates edited_at on save
- Edit mode for SESSION_SET — updates edited_at on save

---

## Current status

Phases 1, 2, and 3 (code) complete. Unit system dropdown (imperial/metric auto-conversion) added to onboarding. 112 Vitest tests passing (6 files) including full signUp→onboard flow tests. All code on branch `feature/phase-3-auth-onboarding` (based on `dev`). Google OAuth credentials created.
Repo: https://github.com/JavierMajano/fitapp

Remaining before Phase 3 is fully live: add credentials to `.env` + Railway → run Prisma migration → merge PR → e2e test.
Next code phase: Phase 4 — data seeding (exercise library, food APIs, default routines).

---

## Instructions for Claude Code

- Always work in feature branches off `dev`
- Commit message format: `feat:`, `fix:`, `chore:`, `refactor:`
- All screens use NativeWind className for styling — no StyleSheet.create
- All API calls go through tRPC — no raw fetch calls in components
- Zod schemas live in `server/schemas/` and are shared with the client
- Never put secrets in code — always read from `process.env`
- TypeScript strict mode is on — no `any` types
- Run `npm run typecheck` and `npm run lint` before committing
- Always restart Expo with `npx expo start --clear` after config changes
