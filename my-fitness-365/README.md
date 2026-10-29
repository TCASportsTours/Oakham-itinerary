# My Fitness 365

**Version 1.1.0 · README v2 · 29/10/2026**

A personal, iPhone-first fitness PWA: daily plan, diary, three-session dumbbell programme with a guided workout player, mountain-bike log, chicken-and-veg meal planner with shopping lists, drinks tracker, weight in stones/pounds, body measurements and private progress photos.

- **Stack:** React 19, TypeScript (strict), Vite 8, Tailwind CSS 4, React Router 8, TanStack Query, React Hook Form + Zod, Recharts, date-fns, Dexie (IndexedDB), Supabase (Postgres, Auth, private Storage), vite-plugin-pwa, Vitest + Testing Library, Playwright.
- **Status:** see [`docs/BUILD_STATUS.md`](docs/BUILD_STATUS.md) and [`docs/ACCEPTANCE_CHECKLIST.md`](docs/ACCEPTANCE_CHECKLIST.md). Those files say exactly what is tested, what is untested and what is blocked.

---

## 1. Two storage modes

| Mode | When | Where data lives | Photos |
|---|---|---|---|
| **Local-only** | `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` not set | IndexedDB in this browser only | IndexedDB, clearly labelled with a data-loss warning |
| **Cloud** | Both variables set | IndexedDB (offline copy + sync queue) **and** Supabase Postgres | Private Supabase Storage bucket, per-user folder, RLS-protected |

The app is **local-first** in both modes: every change is written to IndexedDB immediately (so nothing is lost if the app is closed mid-workout), then queued and pushed to Supabase when online. Photos are never silently placed in public storage.

## 2. Run it locally

Requires Node 22+.

```bash
cd my-fitness-365
npm install
npm run dev          # http://localhost:5173 (local-only mode unless .env.local is set)
```

Other scripts:

```bash
npm run build        # type-check + production build (dist/, includes service worker)
npm run preview      # serve the production build on :4173
npm test             # unit + component tests (Vitest)
npm run test:e2e     # end-to-end tests in an iPhone-sized Chromium (Playwright)
npm run test:rls     # Supabase migrations + row-level-security tests on a throwaway PostgreSQL 16
```

`test:rls` needs PostgreSQL 16 binaries installed (`/usr/lib/postgresql/16/bin`). It creates a temporary cluster, applies a small test-only shim of Supabase's `auth`/`storage` schemas, applies the real migrations and runs the isolation tests, then deletes the cluster.

## 3. Set up Supabase (cloud mode)

1. Create a project at supabase.com (choose an EU/London region).
2. **Apply the migrations** in `supabase/migrations/` in filename order — either with the Supabase CLI (`supabase link` then `supabase db push`) or by pasting each file into the SQL editor:
   - `20261028000000_init.sql` — all tables, indexes, server-stamped `updated_at`, row-level security (enabled **and forced**) on every table, same-owner checks for child rows, `delete_my_account()`.
   - `20261028000100_storage.sql` — the private `progress-photos` bucket and owner-only storage policies.
   - Do **not** apply anything in `supabase/tests/` to a real project.
3. Authentication → Providers: keep Email enabled. Decide whether to require email confirmation.
4. Authentication → URL configuration: set the Site URL to your deployed HTTPS address.
5. Copy `.env.example` to `.env.local` and fill in **only** the project URL and the **anon (public)** key from Project Settings → API.

> **Never** put the `service_role` key in any `VITE_` variable or anywhere in this repository. Everything prefixed `VITE_` is bundled into the browser. An automated test checks the built bundle for `service_role`.

### Seed data

Reference data (13 programme exercises + 2 substitutes, Workouts A/B/C, 10 activity templates, 67 ingredients, 41 recipes, the default week and the profile from the brief) lives in `src/data/seed/`. It is seeded **per user on first sign-in**, as the user's own editable copies, with deterministic IDs (UUID v5 of user + key). Seeding is therefore idempotent across devices, and seeded rows are pushed with "ignore duplicates" so they can never overwrite edits made on another device.

## 4. Deploy (HTTPS is required for install + service worker)

Netlify (recommended because you already use it):

1. New site from Git → this repository → branch containing `my-fitness-365/`.
2. **Base directory:** `my-fitness-365`. Build command and publish directory come from `my-fitness-365/netlify.toml` (`npm ci && npm run build`, `dist`).
3. Site settings → Environment variables: add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (or leave both unset for local-only mode).
4. Deploy, then add the site URL to Supabase's Auth URL configuration.

Keep this as a **separate Netlify site** from the Oakham tour site (whose config is the root `netlify.toml`).

Any static host with HTTPS and an SPA fallback to `index.html` works too.

## 5. Connect Strava (optional)

Strava sign-in needs a secret key, so it only works on the deployed site (the Netlify functions in `netlify/functions/` hold the secret; the browser never sees it).

1. At https://www.strava.com/settings/api create an API application. Set **Authorization Callback Domain** to your site's domain only (e.g. `my-fitness-365.netlify.app`, no `https://`).
2. Netlify → Site configuration → Environment variables:
   - `VITE_STRAVA_CLIENT_ID` = the Client ID (public; used by the app)
   - `STRAVA_CLIENT_ID` = the same Client ID (used by the functions)
   - `STRAVA_CLIENT_SECRET` = the Client Secret (**functions only — never a `VITE_` variable**)
3. Redeploy, then in the app: Settings → Strava → **Connect with Strava**.

What it does: asks for `activity:read_all` (so rides marked "Only you" import too); imports rides (road, mountain, gravel, e-bike, virtual) from the last 14 days on first connect and new ones whenever the app opens (at most every 15 minutes); takes Strava's own calorie figure from the detailed activity (or its kilojoules if no calorie figure); matches a ride you already logged by hand on the same day (within 20 minutes' duration) instead of duplicating it; ticks off that day's planned ride. Tokens are kept only on the device (not synced or exported) and are removed on sign-out or **Disconnect**, which also revokes access on Strava.

**Ride calories in the allowance** (Settings → Ride calories): on by default for Strava rides, optional for hand-recorded rides, with a share (%) setting. Once a counted ride is recorded, that day's target becomes the day's non-riding target (gym or rest) plus the ride calories — so a cycling day's built-in riding allowance is never counted twice. Example: rest 2,100 + Strava 1,100 = 3,200 kcal.

## 6. Install on iPhone

1. Open the HTTPS address in **Safari**.
2. Tap **Share** → **Add to Home Screen** → **Add**.
3. Launch from the Home Screen icon — it opens full-screen with no browser bars.

Notes: install only works from Safari over HTTPS. iOS can clear website storage for sites that go unused for a long time; the app requests persistent storage, but in **local-only mode keep regular backups** (Settings → Export & backup).

## 7. Backup, restore and deletion

- **Settings → Export & backup**
  - *All data (JSON)* — every record, schema-versioned.
  - *CSV* — weight, measurements, workouts (one row per set), nutrition, alcohol, rides.
  - *Full backup including photos* — JSON with photos embedded. **This file contains your private photos**; keep it somewhere private.
- **Restore from backup** validates the file (app name + schema version) and skips any record whose ID already exists, so restoring twice never duplicates anything. Profile and settings are not overwritten.
- **Delete data**
  - Local mode: wipes every table on the device (double confirmation).
  - Cloud mode: removes every photo file from storage, then calls `delete_my_account()`, which deletes the auth user and cascades to every table; local data is then wiped.
- **Sign-out** pushes pending changes (warns if some could not be sent), then clears all local records, cached photos and the sync queue from the device.

## 8. Architecture

```
src/
  app/          session (auth + boot + sync), layout, SW update prompt
  components/   accessible UI primitives, weight input, plan item card, schedule editor
  data/         Dexie schema, repo (all writes + sync queue), sync engine, Supabase client, seed data
  services/     domain logic: diary, workouts, meals, body, rides, photos, reminders, review, backup
  features/     screens: today, diary, workouts (library, player, history, rides), meals, progress, settings
  lib/          dates (Europe/London), units, nutrition, alcohol, stats
supabase/       migrations + RLS tests
e2e/            Playwright journeys + PWA tests
```

**Sync/conflict policy** (single user, a few devices): stable client UUIDs make pushes idempotent upserts; the server stamps `updated_at`; deletions are tombstones (`deleted_at`) so they propagate; a pending local edit beats an incoming remote edit, except a remote deletion, which always wins; photos are hard-deleted (file + row together). Sync runs on launch, when the app becomes visible, when the connection returns and every minute while open — iOS does not provide reliable background sync.

**Diary model:** a date shows the default weekly template until it is edited; the first edit stores that day's activities, so later changes to the default week never rewrite customised or past days. Completed activities cannot be moved or removed; moving an activity leaves a "cancelled — moved to …" record on the original day.

**Dates:** date-only values are stored as `YYYY-MM-DD` calendar dates computed in Europe/London (BST/GMT-safe); timestamps are UTC ISO strings.

## 9. Design

Dark theme by default. GCS palette tokens: near-black `#161615` background, Wicket teal `#51cea7` as the fresh-green accent, Sunset orange `#ff7c1a` for warnings, Ocean purple `#7777c9` for data. Josefin Sans throughout (bundled, works offline), bold italic for headlines. Chart colours were checked with a colour-blind-safety validator; two-series charts also use a dashed line so colour is never the only cue.
