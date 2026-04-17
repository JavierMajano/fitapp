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

## Project structure (Phase 4 — current state)

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
│   │   ├── food.tsx          -- food log with DateNav + "+ Add food" button
│   │   ├── workout.tsx       -- workout with DateNav + "Start session" button + My routines section
│   │   ├── progress.tsx      -- progress charts (placeholder)
│   │   └── profile.tsx       -- profile (placeholder)
│   └── _layout.tsx           -- root layout + AuthGuard (protected routes) + hydrate()
├── components/
│   └── DateNav.tsx           -- reusable prev/next day navigation bar
├── config/
│   └── gluestack.ts          -- full token config (colors, spacing, radii, fonts)
├── e2e/
│   ├── fitapp-kg.js          -- Playwright metric flow: food/workout/progress on Desktop + iPhone 14 (30 tests)
│   ├── fitapp-lbs.js         -- Playwright imperial flow: toggle, lbs workout/progress, round-trip (26 tests)
│   └── report.js             -- Generates playwright-report/index.html from results-kg.json + results-lbs.json
├── playwright-report/        -- E2E output: index.html + screenshots/ + results-*.json (gitignored)
├── lib/
│   ├── trpc.ts               -- tRPC client with Bearer token injection
│   └── units.ts              -- unit conversion: kg↔lbs, cm↔in, toMetric*, displayWeight(kg, unit), WEIGHT_BOUNDS
├── server/
│   ├── prisma/
│   │   ├── schema.prisma     -- full L3 schema (all tables incl. Muscle, Exercise, RoutineDay, etc.)
│   │   └── seed.ts           -- calls seedMuscles + seedExercises + seedRoutines
│   └── src/
│       ├── auth.ts           -- Auth.js config (Google + Apple providers)
│       ├── context.ts        -- tRPC context: JWT Bearer + Auth.js cookie session
│       ├── db.ts             -- Prisma client singleton
│       ├── index.ts          -- Express server (tRPC + Auth.js routes + health)
│       ├── redis.ts          -- ioredis client singleton
│       ├── router.ts         -- tRPC router: auth, user, food, workout procedures (all wired)
│       ├── schemas/
│       │   ├── auth.schemas.ts    -- signUpSchema, signInSchema
│       │   ├── food.schemas.ts    -- foodItemResultSchema, FoodItemResult type
│       │   ├── user.schemas.ts    -- onboardingSchema
│       │   └── index.ts          -- re-exports all schemas
│       ├── seed/
│       │   └── exercise-seed.ts  -- seedMuscles (wger.de), seedExercises, seedRoutines (PPL/UL/FB)
│       └── services/
│           ├── auth.service.ts    -- signUp (bcrypt hash), signIn (bcrypt compare), getSafeUser
│           ├── food.service.ts    -- searchFood (USDA), getByBarcode (Open Food Facts), Redis 24h TTL
│           ├── social.service.ts  -- googleSignIn (token verification + find-or-create)
│           ├── user.service.ts    -- completeOnboard + TDEE/macro calculation
│           └── workout.service.ts -- listRoutines, startSession, logSet, endSession (in-memory)
├── store/
│   ├── auth.ts               -- Zustand auth store with expo-secure-store persistence
│   ├── fitlog.ts             -- Zustand store: food entries, workout sessions, body weight, mock seed data
│   └── units.ts              -- Zustand store: unitSystem ('metric'|'imperial') with localStorage persistence
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
│       └── ci.yml            -- PR: lint + typecheck + expo-doctor
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

### 8. auth.signIn was not validating passwords (fixed)

`signIn` in `server/src/services/auth.service.ts` was returning a token for any password.
Fixed by hashing with `bcrypt.hash(password, 10)` on `signUp` and comparing with `bcrypt.compare` on `signIn`.
`bcryptjs` was already a declared dependency — no new packages needed.

### 7. expo-secure-store is native-only (no web support)

`expo-secure-store` throws on web. `store/auth.ts` uses a `Platform.OS === 'web'`
check to fall back to `localStorage` for all `getItem`/`setItem`/`deleteItem` calls.

### 9. Zustand unit store must persist to localStorage (store/units.ts)

`addInitScript` in Playwright runs on every `page.goto()`. Without localStorage
persistence, unit preference resets to `'metric'` on every tab navigation.
Fix: `loadUnitSystem()` reads from `localStorage` at store init; `setUnitSystem()` writes
to `localStorage` before calling `set()`. Key: `fitapp_unit_system`.

### 10. addInitScript must NOT reset state that should persist (Playwright E2E)

When testing the lbs flow, `addInitScript` injects auth keys on every navigation. If you
also set `fitapp_unit_system` there, it overwrites the lbs preference set by the profile
toggle after every `page.goto()`. Fix: only inject auth keys in `addInitScript` for lbs
flow tests. Unit pref is set via the profile toggle and persists naturally via localStorage.

### 11. Food modal selector ambiguity on web (app/(tabs)/food.tsx)

`getByText('Dinner')` matches both the background meal card header AND the modal meal
button (food tab always renders all 4 meal sections). `getByText('Log')` matches both the
"Food Log" screen header and the "Log N kcal" button.
Fix: Added `testID="meal-btn-{key}"` and `testID="log-food-btn"` to food.tsx. Use
`[data-testid]` locators in Playwright for these elements.

### 12. \_\_dirname wrong when Playwright scripts run via skill's run.js wrapper

The skill runner executes scripts from its own directory, making `__dirname` resolve to
the skill directory instead of the project. On Windows, `/tmp` paths are not found.
Fix: Write E2E scripts to the project `e2e/` directory and run them directly:
`node e2e/fitapp-kg.js` from the project root. `__dirname` then resolves correctly to
`<project>/e2e/`.

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

### Phase 3 — Auth & onboarding flow ✅ COMPLETE

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
- **Auth + onboarding flow tests** (`server/src/__tests__/flows/auth-onboarding.flow.test.ts`) — 5 Vitest flow tests covering the full signUp → signIn → completeOnboard path and all error branches; 113 tests total across 6 files
- **Password hashing** (`server/src/services/auth.service.ts`) — `bcryptjs` (already a dependency); `signUp` hashes with `bcrypt.hash(password, 10)`; `signIn` validates with `bcrypt.compare` — wrong password throws `UNAUTHORIZED`
- **Playwright E2E suite** (`C:/tmp/playwright-test-phase3.js`) — 23 tests covering backend API (health, auth, TDEE) and Expo Web UI (AuthGuard redirect, sign-in/sign-up screens, onboarding Steps 0–2); all 23 pass

### Phase 4 — Data seeding & food/workout APIs ✅ COMPLETE

#### Phase 4-A — Exercise library seeder

- `server/src/seed/exercise-seed.ts` — three seed functions:
  - `seedMuscles(db)` — fetches ~40+ muscles from wger.de, stores with `group` and `bodyRegion`
  - `seedExercises(db)` — fetches ~800 exercises from wger.de, strips HTML, links primary/secondary muscles
  - `seedRoutines(db)` — creates 3 system routines (userId=null): Push/Pull/Legs (6-day), Upper/Lower (4-day), Full Body (3-day)
- `server/prisma/seed.ts` — thin entry-point calling all three functions
- 154/154 Vitest tests pass

#### Phase 4-B — Food API service

- `server/src/services/food.service.ts`:
  - `searchFood(query, redis)` — USDA FoodData Central text search, up to 10 results, Redis cache 24h TTL
  - `getByBarcode(barcode, redis)` — Open Food Facts barcode lookup, Redis cache 24h TTL, graceful null on miss
- `server/src/schemas/food.schemas.ts` — `foodItemResultSchema` (name, brand, barcode, source, sourceRefId, caloriesPer100g, proteinPer100g, carbsPer100g, fatPer100g, fiberPer100g, sugarPer100g, sodiumPer100g)
- tRPC routes wired: `food.search` (public GET), `food.byBarcode` (public GET)

#### Phase 4-C — Workout session procedures

- `server/src/services/workout.service.ts` (in-memory store):
  - `listRoutines(userId, db)` — returns active routines (global + user-owned)
  - `startSession(userId, input, db)` — creates session; throws NOT_FOUND for invalid routineId
  - `logSet(userId, input, db)` — logs a set; throws NOT_FOUND/FORBIDDEN/BAD_REQUEST
  - `endSession(userId, input, db)` — marks session ended; throws BAD_REQUEST if already ended
- tRPC routes wired: all 4 workout procedures (listRoutines public, rest protected)

#### Playwright E2E suite expanded (Phase 4)

- `C:/tmp/playwright-test-phase3.js` — expanded to **39 tests** (was 23):
  - Section 5: Food API — USDA search, empty query validation, barcode lookup (Nutella), unknown barcode
  - Section 6: Workout API — listRoutines, startSession (ad-hoc), logSet, endSession, double-end guard, invalid routineId guard
  - Section 7: UI tabs — Food tab ("Food log" heading, "+ Add food") and Workout tab ("Workout" heading, "Start session", "My routines")
  - **39/39 pass**
- tRPC query URL format: `GET /trpc/{procedure}?input={JSON}` (no `json` wrapper, no batch prefix)

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

Phases 1–4 fully complete. 154 Vitest tests passing. Playwright E2E suite: 54/54 (39 API/onboarding tests + kg/lbs UI flows × Desktop + iPhone 14). kg/lbs unit switching live across profile, workout, and progress tabs (`store/units.ts` with localStorage persistence). CI playwright job added to `.github/workflows/ci.yml`: builds Expo web, serves static, runs E2E, uploads `playwright-report/` as a GitHub Actions artifact. Password hashing, food APIs, workout session lifecycle, and exercise seeder all complete. Deployed to Railway staging.
Repo: https://github.com/JavierMajano/fitapp

Next code phase: Phase 5 — CI/CD hardening (Sentry error tracking, Expo EAS Build dev profile, environment variable documentation), then Phase 6 — wire UI tabs to real tRPC backend.

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
