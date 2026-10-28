# My Fitness 365 — Build status

**Document v1 · app v1.0.0 · 28/10/2026**

Status key: ✅ Complete and tested · 🟡 Implemented but not fully tested · ⛔ Blocked · ⬜ Not yet implemented

## Verification run for this version

| Check | Command | Result |
|---|---|---|
| Type-check (strict) + production build | `npm run build` | ✅ passes |
| Unit + component tests | `npm test` | ✅ 36 passed (2 diagnostic reports skipped by design) |
| End-to-end, iPhone 13 viewport, Chromium | `npm run test:e2e` | ✅ 10 passed; also 20/20 with `--repeat-each=2` |
| Migrations + row-level security on PostgreSQL 16 | `npm run test:rls` | ✅ 22 checks passed |
| Deployed to a public HTTPS URL | — | ⬜ **Not deployed.** No hosting credentials were used; see README §4 |
| Tested on a physical iPhone | — | ⬜ **Not done.** Only Chromium with iPhone 13 emulation |
| Tested against a live Supabase project | — | ⬜ **Not done.** No project credentials were available. Sync was tested against an in-memory Supabase stand-in; RLS was tested on real Postgres with a test-only shim of `auth`/`storage` |

## Where the code lives

Built in `my-fitness-365/` on branch `claude/my-fitness-365` of the `oakham-itinerary` repository, because that was the only repository in this session. The Oakham site on `main` (published from the repo root by Netlify) was not touched. **Recommended:** move this folder into its own repository (`git subtree split --prefix my-fitness-365`) before going live.

## Phase log

### Phase 1 — Foundation ✅
Vite + React + strict TS; Tailwind theme; router; bottom navigation with safe areas; Dexie schema; repo layer; profile seeded from the brief; onboarding (7 steps, skippable, fresh weigh-in); Today shell; diary with week/month views; scheduling with defaults that only materialise when a day is edited.
*Done when:* plan visible, activities changed, changes survive reload — e2e `diary` journey.

### Phase 2 — Workouts ✅ (images/video ⛔, see blockers)
Library of 15 exercises with full written coaching; editable Workouts A/B/C (sets, reps, rest, suggested weight, substitute exercise); guided player (per-set weight/reps, done ticks, rest timer with +15s, previous/next, skip, finish, abandon); every set saved immediately; resume after closing; history; previous performance shown in player and plan; strength chart per exercise.
*Done when:* all three sessions completable, results reappear after reopening — e2e `workout` journey and unit tests.

### Phase 3 — Meals ✅
67 ingredients (per-100g estimates), 41 recipes (7 breakfasts, 10 lunches, 14 dinners, 10 snacks) with macros computed from ingredient weights; recipe detail with servings; day planner (suggest day, fill 7 days, copy yesterday, swap one meal, change recipe/portions); suggestions sized to the day's calorie target; food log kept separate from the plan; custom foods and "on the bike" foods; calorie/macro targets by day type; shopping lists (consolidated, grouped, tick/edit/remove/add, copy, native share); drinks tracker with units, kcal workings and the 14-unit weekly guideline.
*Done when:* 7-day plan, dinner swap, meals logged, shopping list — e2e `meals` journey.

### Phase 4 — Body progress ✅ (camera on device 🟡)
Weight (st/lb or kg entry, kg storage at 3 dp, edit/delete, 7-day rolling average, 30/90-day change, milestone progress, chart only with ≥2 real points); measurements (10 required + optional types, cm/in, partial saves, edit/delete, baseline/latest/abs/% per type, charts, left/right paired charts, how-to-measure help with tape illustration); photos (take/upload, front/side/back, rotate, crop, zoom/offset without distortion, notes, retake, timeline, side-by-side, slider, overlay with opacity, alignment, full-screen pinch-zoom); four-week review built only from recorded data with a "missing data" list.

### Phase 5 — Cycling + diary integration ✅
Ride log (date, time, duration, distance, elevation, RPE, notes, intensity), editable kcal estimate shown with its working (MET × weight × hours), never added to the food allowance; weekly ride totals; rides complete their planned diary item; diary day shows planned vs recorded workouts and rides, nutrition plan vs eaten, drinks, weight, notes, energy, mood and sleep.

### Phase 6 — PWA, testing, polish ✅ / 🟡
Manifest, icons (192/512/maskable/apple-touch), service worker precache, offline app shell and `offline.html`, update prompt, offline banner; export (JSON, CSV, photo backup), validated import; sign-out wipe; account deletion; code-split charts; accessible labels, focus rings, 44px+ touch targets, reduced-motion support.

## Bugs found and fixed during the build
- Onboarding finished but the dashboard bounced back to step 1 (race between saving and the route guard). Fixed: the onboarding screen redirects once the saved profile says it is complete.
- Sync failures recorded `[object Object]` because Supabase errors are not `Error` instances. Fixed (`errorMessage`), covered by a test.
- Suggested meal days came in 400–850 kcal under target. Fixed: portion/snack sizing (`sizeToTarget`), covered by a test.
- Shopping-list ticks lagged a frame behind the tap. Fixed with optimistic state.

## Blockers ⛔

1. **Exercise demonstration videos.** None are verified. This build environment's network blocks YouTube (the proxy refused `youtube.com/oembed`, so existence and embedding permission could not be checked). Rather than invent URLs, every exercise shows "Video unavailable" with the written instructions intact. You can paste a YouTube link per exercise (labelled "added by you — not verified"); it loads only when you tap *Load video*. Fix: fill `VERIFIED_VIDEOS` in `src/data/seed/exercises.ts` from a network that allows YouTube.
2. **Exercise images.** No licensed start/finish images are bundled; a placeholder icon is shown. You can add your own start/finish photos per exercise. These are stored **on that device only** and are not synced.
3. **Verified UK food composition data (e.g. CoFID).** Not integrated. Ingredient values are hand-entered typical label values, marked as estimates in the app.

## Not yet implemented ⬜
- Scheduled push notifications to a locked phone (needs a Web Push server + VAPID keys). Reminders appear on the Today screen instead.
- Strava / Apple Health integration (deliberately not faked).
- Light theme (dark only, as the brief's default).
- Recipe food photos (no licensed images).
- Moving local-only data into a cloud account in one step. Workaround: export JSON in local mode, sign in, then restore.

## Assumptions made (all editable in the app)
| Assumption | Why / working |
|---|---|
| Gym-only day target **2,300 kcal** | The brief requires a separate gym-only target but gives no figure. 2,300 = rest day 2,100 + ~200 for a 30–40 min dumbbell session. Settings → Daily targets |
| Fat share of food calories **27%** | Used to split targets into grams. Example (cycling day): protein 170g × 4 = 680; fat 2,600 × 0.27 ÷ 9 = 78g (702 kcal); carbs (2,600 − 680 − 702) ÷ 4 = 304.5 → shown as 305g. Check: 680 + 702 + 1,218 = 2,600 kcal |
| Ride energy = **MET × body weight × hours**, MET 6.8 easy / 8.5 moderate / 10 long | Approximate mountain-biking values (Compendium of Physical Activities). Example: 8.5 × 88.9kg × 1.5h = 1,133 kcal. Shown as an estimate, editable per ride, never added to the food allowance |
| Day type is inferred from the plan | Social evening + any ride = social + cycling; moderate/long ride = cycling; workout = gym; otherwise rest. Override per day in the Diary |
| Thursday = moderate ride + social evening; Saturday = recovery + social evening | From the brief's default week; Sunday's "easy/moderate" ride is seeded as moderate |
| Ingredient values | Typical UK label values per 100g, entered by hand and labelled as estimates (not CoFID) |
| Meal suggestions | Main meals can be scaled up to 1.5 portions and up to two extra snacks added to approach the day's target. Protein lands around 170–230g on suggested days |
| Drinks presets | Double rum + Diet Coke = 50ml at 40% + ~1 kcal mixer. Never logged automatically |
| Visual design | The brief asks for a dark theme with a fresh-green accent. This uses the GCS palette inside that: near-black #161615, Wicket teal #51cea7 as the accent, Sunset orange for warnings, Ocean purple for data, and Josefin Sans throughout. Easy to retheme in `src/index.css` |
| File versioning | Version numbers are in the app (1.0.0) and in each document's header. Source files keep the filenames the toolchain expects; the brief fixes the doc filenames (`BUILD_STATUS.md`, `ACCEPTANCE_CHECKLIST.md`) |
