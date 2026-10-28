# My Fitness 365 — Acceptance checklist

**Document v1 · app v1.0.0 · 28/10/2026**

✅ Complete and tested · 🟡 Implemented but not fully tested · ⛔ Blocked · ⬜ Not yet implemented

"e2e" = Playwright test in `e2e/` (Chromium, iPhone 13 viewport). "unit" = Vitest in `src/`. "rls" = `supabase/tests/rls_test.sql`.

## Brief §26 — ready for first use

| # | Criterion | Status | Evidence / notes |
|---|---|---|---|
| 1 | Install on iPhone home screen | 🟡 | Manifest, icons, standalone mode and service worker are tested (e2e `pwa`). Not yet deployed over HTTPS or tried on a real iPhone |
| 2 | Open the Today dashboard | ✅ | e2e (every journey starts there) |
| 3 | See my planned activity | ✅ | e2e `diary`; unit `diary` |
| 4 | Select another workout itinerary | ✅ | e2e `diary` (add activity, reschedule); unit |
| 5 | Start Monday's chest workout | ✅ | e2e `workout` (Workout A) |
| 6 | View the exercise image | ⛔ | No licensed images; placeholder shown; you can add your own photo (device-only). See BUILD_STATUS blockers |
| 7 | Expand its instructions | ✅ | e2e `workout` |
| 8 | Open a working demonstration video, where verified | ⛔ | None verified (YouTube blocked in the build environment). Shows "Video unavailable"; you can add your own link |
| 9 | Record weight and reps lifted | ✅ | e2e `workout`; unit |
| 10 | Tick off sets | ✅ | e2e `workout` |
| 11 | Finish and save the workout | ✅ | e2e `workout` |
| 12 | Reopen and see it in history | ✅ | e2e `workout` (reload → history; "Last: 8kg × 11") |
| 13 | Record a mountain bike ride | ✅ | e2e `ride` |
| 14 | Select chicken and vegetables for dinner | ✅ | e2e `meals` |
| 15 | Swap the dinner for another recipe | ✅ | e2e `meals`; unit (other meals unchanged) |
| 16 | Record what I actually ate | ✅ | e2e `meals`; unit (planned ≠ eaten) |
| 17 | Generate a weekly shopping list | ✅ | e2e `meals`; unit (aggregation) |
| 18 | Enter today's weight in stones and pounds | ✅ | e2e `onboarding`, `progress`; unit conversions |
| 19 | Record waist, chest and shoulders | ✅ | e2e `progress` |
| 20 | Take front, side and back photos | 🟡 | Upload path tested in e2e. Camera capture on iPhone and HEIC files not tested on a device |
| 21 | Compare photos from different dates | ✅ | e2e `progress` (side-by-side, slider, overlay) |
| 22 | Accurate weight and measurement trends | 🟡 | Maths unit-tested (rolling average, ordering, change). Charts render in screenshots; values on charts not asserted in e2e |
| 23 | Export my data | ✅ | e2e `export` (JSON contents checked); CSV and photo backup not asserted 🟡 |
| 24 | No lost records after closing/reopening | ✅ | e2e reloads in diary, workout, meals; offline set logging (e2e `pwa`) |

## Brief §25 — testing requirements

| Area | Test | Status |
|---|---|---|
| Diary | add activity · reschedule · combine activities · save note · keep completed history | ✅ unit + e2e |
| Workout | start · complete set · update weight/reps · navigate · resume · save · previous performance | ✅ unit + e2e |
| Nutrition | select recipe · change portions · log meal · macros · planned vs eaten · shopping list | ✅ unit + e2e |
| Measurements | unit conversion · partial entry · edit · delete · 7-day average · chart ordering | ✅ unit (+ e2e entry) |
| Photos | upload · read own · deny other user · remove · compare two dates · missing photos | ✅ e2e (upload/compare/remove), rls (deny other user, storage folder isolation), sync unit (file + metadata deleted together). "Missing photos" is handled in the UI (empty states) but has no dedicated test 🟡 |
| Data protection | RLS isolation · no unauthenticated access · no exposed privileged keys · sign-out clears local state | ✅ rls, e2e bundle scan, unit wipe |
| PWA | manifest · offline fallback · offline workout progress · sync after reconnecting | ✅ e2e for the first three; sync-after-reconnect ✅ unit (mocked Supabase), 🟡 not against live Supabase |

## Other brief requirements (selected)

| Requirement | Status |
|---|---|
| Five-tab bottom nav, safe areas, dark theme, large targets | ✅ |
| Starting profile from §3; fresh weigh-in at onboarding; nothing fabricated | ✅ |
| Calorie targets by day type with reconciling macros (4/4/9, alcohol 7 kcal/g, separate) | ✅ unit |
| UK units = ml × ABV ÷ 1000 (50ml at 40% = 2 units, ~110 kcal) | ✅ unit |
| Europe/London dates across daylight-saving changes | ✅ unit |
| Private photo storage, owner-only paths, no public URLs, no AI processing | ✅ rls; 🟡 not run against live Supabase |
| Offline: cached app, today's plan, workout logging, queued sync | ✅ |
| Export JSON/CSV, validated import, deletion, account deletion | ✅ / 🟡 (account deletion tested in rls; storage-file removal step not tested live) |
| Push notifications | ⬜ (in-app reminders only) |
| Strava / Apple Health | ⬜ (not faked) |
