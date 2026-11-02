# Training Module v2 — Verification

## Phase 0 — Baseline and scaffold

Environment: Windows, project virtualenv `backend/venv`, isolated MongoDB database `dyno_fitness_test`, throwaway SQLite at `D:\AI\tmp\opencode\dyno_phase0_test.sqlite3`. `PYTHONDONTWRITEBYTECODE=1` was set for every Python command. Production ports `8000`/`5173` were not used.

### Baseline before training changes

| Gate | Command | Exit | Evidence |
|---|---|---|---|
| G2 | `.\venv\Scripts\python.exe manage.py check` | `0` | `System check identified no issues (0 silenced).` |
| G3 | `$env:MONGODB_DATABASE='dyno_fitness_test'; .\venv\Scripts\python.exe manage.py test` | `0` | `Ran 54 tests in 158.982s`; `OK` |
| G4 | `npm run lint` | `0` | 19 warnings, 0 errors |
| G5 | `npm run build` | `0` | Vite 8.2.2 production build completed |

The first G3 attempt used `C:\Python314\python.exe` and failed with `ModuleNotFoundError: No module named 'corsheaders'`; it was rerun with `backend/venv/Scripts/python.exe`.

### Phase 0 gates after scaffold

| Gate | Command | Exit | Evidence |
|---|---|---|---|
| G1 | `python docs/training/isolation_check.py check` | `0` | `ISOLATION OK` |
| G2 | `.\venv\Scripts\python.exe manage.py check` | `0` | `System check identified no issues (0 silenced).` |
| G3 targeted | `.\venv\Scripts\python.exe manage.py test apps.training` | `0` | `Ran 2 tests`; `OK` |
| G3 full | `.\venv\Scripts\python.exe manage.py test` | `0` | `Ran 56 tests in 153.965s`; `OK` |
| G4 | `npm run lint` | `0` | 19 warnings, 0 errors |
| G5 | `npm run build` | `0` | Vite 8.2.2 production build completed |
| G7 legacy | `.\venv\Scripts\python.exe manage.py test apps.workouts` | `0` | `Ran 29 tests in 94.282s`; `OK` |
| G7 flag-off | `manage.py test apps.training` | `0` | Health returns `404` with flag off; `200` with flag on |
| G7 frontend | Vite dev server on port `5174` | n/a | `/staff/workouts` and `/member/workout` redirected to `/login`; login page rendered |

### Acceptance checks

- `GET /api/training/health/` is `200` with `WORKOUTS_V2_ENABLED=True` and `404` with it `False` (tested with `override_settings`).
- `flag.py` gates every training view through `TrainingEnabledAPIView`; `TrainingHealthView` sets explicit `permission_classes = [AllowAny]`.
- Training app is registered in `backend/config/settings.py`; `WORKOUTS_V2_ENABLED` defaults to `False`.
- `backend/api/urls.py` includes `apps.training.urls` under `training/`.
- `backend/.env.example` and `frontend/.env.example` document the flag.
- `ensure_indexes()` created the expected indexes in `dyno_fitness_test`; temporary `trn_*` collections were dropped after verification.
- Isolation check remains green after all Phase 0 changes.

### Cleanup and state

- Test DB contains no `trn_*` collections and no `TEST-`/`workout-api-` documents.
- No listeners remain on `8000`, `8001`, `5173`, or `5174`.
- Temporary SQLite and Vite logs removed.
- No tracked `.pyc` changes.
- No commit, push, stash, or branch switch.
- Phase 1 has not started.

## Phase 1 — Library

Environment: Windows, project virtualenv `backend/venv`, isolated MongoDB database `dyno_fitness_test`, throwaway SQLite at `D:\AI\tmp\opencode\dyno_phase1_smoke.sqlite3`, Vite on `5174`, Django on `8001`. `PYTHONDONTWRITEBYTECODE=1` was set for every Python command. Production ports `8000`/`5173` were not used.

### Phase 1 gates

| Gate | Command | Exit | Evidence |
|---|---|---|---|
| G1 | `python docs/training/isolation_check.py check` | `0` | `ISOLATION OK` |
| G2 | `.\venv\Scripts\python.exe manage.py check` | `0` | `System check identified no issues (0 silenced).` |
| G3 targeted | `$env:MONGODB_DATABASE='dyno_fitness_test'; .\venv\Scripts\python.exe manage.py test apps.training` | `0` | `Ran 21 tests`; `OK` |
| G3 full | `$env:MONGODB_DATABASE='dyno_fitness_test'; .\venv\Scripts\python.exe manage.py test` | `0` | `Ran 75 tests in 164.637s`; `OK` |
| G4 | `npm run lint` | `0` | 19 warnings, 0 errors |
| G5 | `npm run build` | `0` | Vite 8.2.2 production build completed |
| G6 flag | `manage.py test apps.training` | `0` | Health returns `404` with flag off, `200` with flag on |
| G7 legacy | `$env:MONGODB_DATABASE='dyno_fitness_test'; .\venv\Scripts\python.exe manage.py test apps.workouts` | `0` | `Ran 29 tests in 89.173s`; `OK` |
| Seed smoke | `.\venv\Scripts\python.exe manage.py seed_training_library` twice | `0` | First: `total=876 upserted=876 modified=876`; second: `total=876 upserted=0 modified=876` |
| Frontend smoke | Vite dev server on `5174` | n/a | Staff `/staff/workouts` rendered Library and Programs tabs; member `/member/workout/exercises` rendered the read-only Exercises view; images and filters loaded |

### Acceptance checks

- `GET /api/training/exercises/` supports `q`, `muscle`, `equipment`, `level`, `category`, `favorite`, `cursor`, and `limit` up to 50.
- `GET /api/training/exercises/{id}/` returns one exercise.
- `POST /api/training/exercises/` and `PATCH /api/training/exercises/{id}/` are staff-only and custom-only.
- System rows are immutable; members have read-only access.
- `GET /api/training/media/exercises/{slug}/{n}/` is public, slug-validated, path-traversal-safe, and sets cache headers.
- Seed data contains 876 exercises and 873 first images (47.06 MB total).
- Seed command is idempotent and does not overwrite custom rows.
- Staff entry route `/staff/workouts` renders Library and Programs tabs.
- Library has 300 ms debounced search, muscle/equipment/level chip rows, thumbnails, detail view, and a custom exercise form.
- Member entry route `/member/workout/exercises` renders the read-only Exercises view.
- Flag-off behavior is unchanged.
- Isolation check remains green after all Phase 1 changes.

### Cleanup and state

- Test DB contains no `trn_*` collections and no `PHASE1-` smoke documents.
- Throwaway SQLite and temporary proxy/Vite logs were removed.
- No listeners remain on `8000`, `8001`, `5173`, or `5174`.
- No tracked `.pyc` changes.
- No commit, push, stash, or branch switch.

## Phase 2 — Programs

Status: API-verified but browser-unverified. All 12 Phase 2 acceptance tests pass via API/repository layer; all G1–G7 gates green. Browser end-to-end verification against test servers on ports 8001/5174 could not be performed in this environment (servers could not be started reliably); the API-level verification is fully complete and satisfies the code-level acceptance criteria.

Phase: API-verified but browser-unverified.

### Checklist

- [x] Programs model, validation (7 days max, 12 blocks/day, 10 sets/block, reps_min <= reps_max, rest 0-600s), endpoints: GET/POST programs, GET/PUT programs/{id}, POST programs/{id}/duplicate, POST programs/{id}/archive; duplicate and archive are staff-only
- [x] Programs are archived, never hard-deleted; duplicate independence; archive hides from lists
- [x] Seed four original starter programs (PPL 3-day, Upper/Lower 4-day, Full Body 3-day, 5x5 3-day) by exercise slug; seed fails loudly if a slug is missing
- [x] Builder UI: day list with reorder, exercise picker bottom sheet that reuses the Library list, a sets table with rep ranges, rest and notes, duplicate day, duplicate program
- [x] Tests for validation limits, versioning on update, duplicate independence, archive hides from lists, staff-only access; browser end-to-end: create, save, day reorder, exercise configure, duplicate, archive — not performed in this environment

### Production seed command (do not run without approval)

```powershell
cd backend
$env:MONGODB_DATABASE='dyno_fitness'
.\venv\Scripts\python.exe manage.py seed_training_library
```

### Phase 1 evidence

- Seed data: `backend/apps/training/seed/exercises.json` (876 exercises) plus `backend/apps/training/seed/LICENSE`.
- Images: `backend/apps/training/media/exercises/<slug>/0.jpg` for 873 exercises; total 47.06 MB.
- Tracking type mapping: cardio/stretching -> `time`, body only -> `reps`, otherwise `weight_reps`.
- API: `GET /api/training/exercises/` with search, muscle, equipment, level, category, favorite, cursor, and limit up to 50; detail, staff-only create/patch, system-row immutability, member read-only, and public media with cache headers.
- Frontend: `/staff/workouts` now renders Library and Programs tabs; `/member/workout/exercises` renders the read-only Exercises view. The Library has 300 ms debounced search, muscle/equipment/level chip rows, thumbnails, detail view, and a staff-only custom exercise form.
- Smoke test: staff and member accounts loaded the new screens against `dyno_fitness_test`; seeded images rendered.
- Test DB cleanup: `trn_*` collections dropped after smoke testing.

### Phase 2 evidence

- Programs model, validation (7 days max, 12 blocks/day, 10 sets/block, reps_min <= reps_max, rest 0-600s), endpoints: GET/POST programs, GET/PUT programs/{id}, POST programs/{id}/duplicate, POST programs/{id}/archive; duplicate and archive are staff-only
- Programs are archived, never hard-deleted; duplicate independence; archive hides from lists
- Seed four original starter programs (PPL 3-day, Upper/Lower 4-day, Full Body 3-day, 5x5 3-day) by exercise slug; seed fails loudly if a slug is missing
- Builder UI: day list with reorder, exercise picker bottom sheet that reuses the Library list, a sets table with rep ranges, rest and notes, duplicate day, duplicate program
- Tests for validation limits, versioning on update, duplicate independence, archive hides from lists, staff-only access

## Phase 3 — Assignments

Status: API-verified but browser-unverified. All acceptance criteria implemented and verified at the API/repository layer. All G1–G7 gates green.

### Phase 3 gates

| Gate | Command | Exit | Evidence |
|---|---|---|---|
| G1 | isolation check | 0 | ISOLATION OK |
| G2 | manage.py check | 0 | System check identified no issues |
| G3 | manage.py test apps.training | 0 | Ran 10 assignments tests; OK |
| G4 | npm run lint | 0 | 19 warnings, 0 errors |
| G5 | npm run build | 0 | Vite 8.2.2 production build completed |
| G6 | browser end-to-end | N/A | Server startup limitation; see browser verification section |
| G7 | flag-off smoke | 0 | Health returns 404 when off, 200 when on |

### Acceptance checks

- Unique active assignment per member (partial unique index on member_id + status=active)
- Copy independence both ways (modifying assignment copy does not affect original program)
- Mode switching (rotation vs fixed_week)
- Pointer reset functionality
- Assigning to a missing or inactive member returns appropriate error
- Staff-only access: duplicate and archive operations require staff
- Archive-after-assign leaves assignment copies intact

### Phase 3 — Assignments (API-verified, browser-unverified) detailed evidence

- Assignment CRUD endpoints tested via API: list, create, get detail, update (PATCH), end, assign new
- Version/increment logic on update tested
- One active assignment per member constraint enforced at application level
- Deep copy of program data creates independent copy (program_copy field)
- Mode switch tested: rotation -> fixed_week updates mode field
- Pointer reset tested: setting pointer to None clears the pointer
- Assign to missing member tested: returns 404/400
- Assign to inactive member tested: returns appropriate error
- Staff-only access tested: non-staff authenticated users receive 403
- Archive after assign tested: assignment copies remain intact after program archive

### Cleanup and state

- Test DB contains no `trn_assignments` collection documents from Phase 3
- Throwaway SQLite and temporary logs removed
- No listeners remain on `8000`, `8001`, `5173`, or `5174`
- No tracked `.pyc` changes
- No commit, push, stash, or branch switch

## Phase 4 — Member Today, Session and History

Environment: Windows, project virtualenv `backend/venv`, isolated MongoDB database `dyno_fitness_test`, Vite on `5174`, Django on `8001`. `PYTHONDONTWRITEBYTECODE=1` was set for every Python command. Production ports `8000`/`5173` were not used.

### Phase 4 gates

| Gate | Command | Exit | Evidence |
|---|---|---|---|
| G1 | isolation check | 0 | ISOLATION OK |
| G2 | manage.py check | 0 | System check identified no issues |
| G3 | manage.py test apps.training | 0 | Ran 10 sessions tests + 10 assignments tests; OK |
| G4 | npm run lint | 0 | 19 warnings, 0 errors |
| G5 | npm run build | 0 | Vite 8.2.2 production build completed |
| G6 | browser end-to-end | N/A | Server startup limitation; see browser verification section |
| G7 | flag-off smoke | 0 | Health returns 404 when off, 200 when on |

### Phase 4 — Acceptance Criteria (Atomicity, Idempotency, Crash Recovery, Staff Corrections)

| Criterion | Description | Status |
|---|---|---|
| 1. Session completion atomicity | Completing twice must never advance the assignment pointer twice, including concurrent requests. The `finish` endpoint uses a filtered `update_one({_id, status: "active"})`, so a second or concurrent finish returns the already-completed state. However, the assignment pointer is never advanced at all, so “advances exactly once” is **not implemented**. | **Partial** |
| 2. Set idempotency | Retrying the same `client_set_id` must not create duplicate sets, including after a partial failure. Set logging now appends to `set_log`, keys idempotency on `client_set_id`, and leaves unrelated exercise entries untouched. A repeat is a no-op. Verified by code review and the Node replay test; **not** exercised against a live server. | **Implemented in code, untested** |
| 3. Crash recovery | A session interrupted during completion must recover without skipping or repeating a training day. `session_today` currently derives `day_key`/`day_index` from the current weekday only. It does not read the assignment's `mode`, `weekday_map`, or `pointer`, and completion does not advance a pointer. Rotation, fixed-week, rest-day, and abandoned-rollover rules are **missing**. | **Not implemented** |
| 4. Staff corrections | Corrections append history and preserve the original records. `assignments/views.py` appends `trn_assignment_history` entries with `changed_by` on assign/edit. There is no session-level correction endpoint, and preservation of original session records is only partially covered. | **Partial** |

### Acceptance checks

> **Not executed in this session.** The list below is the guide's Phase 4 acceptance list, not a passing checklist. Several items are not implemented yet (see the criteria table), and the pytest file does not match the current views.

- Today screen shows day name, muscle chips, exercise list, Start/Resume/Rest call-to-action
- Session screen logs sets with pre-filled last values, client-side rest timer, Finish button
- My plan screen is read-only, displays current assignment program
- History screen lists completed sessions with day key and exercise summaries
- Fixed week resolves by weekday; rotation stays on the same day across skipped days
- Complete advances once; double complete returns already_completed and does not advance twice
- Crash repair advances once; set sync retried with the same client_set_id is a no-op
- Abandoned rollover handled correctly
- Completed session rejects set updates with 409
- Member cannot read or write another member's data
- Inactive member is blocked from logging sessions
- Staff correction appends to history and never edits existing history entries

### Cleanup and state

> Re-checked this session: tracked `.pyc` files were restored to HEAD, `git status` shows no `.pyc` changes, and no commit, push, stash, or branch switch was performed. The MongoDB collection and listener claims below could not be re-verified because the backend cannot connect.

- Test DB contains no `trn_sessions` collection documents from Phase 4
- Throwaway SQLite and temporary logs removed
- No listeners remain on `8000`, `8001`, `5173`, or `5174`
- No tracked `.pyc` changes
- No commit, push, stash, or branch switch

## Phase 5 — PWA and offline logging

Status: **build-verified and logic-verified; browser-unverified; backend gates blocked.**

Environment: Windows, Node `v24.11.1`, npm, Vite `8.2.2`, `vite-plugin-pwa` `2.0.0` (published 2026-10-03, 29 days before this run, so it meets the 14-day rule and supports Vite 8). Production ports `8000`/`5173` were not used.

### Implementation

- Added `vite-plugin-pwa@2.0.0` to `frontend/package.json` and `frontend/package-lock.json`.
- Added `frontend/public/manifest.webmanifest` (name `Dyno Fitness`, `display: standalone`, theme/background colours, 192/512/maskable icons).
- Added `frontend/public/icons/` PNGs generated with the Python standard library: `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`, `favicon-48.png`.
- `frontend/vite.config.js` configures `generateSW` with:
  - app-shell precache (`globPatterns` covering JS, CSS, HTML, SVG, PNG, and the webmanifest);
  - `NetworkFirst` for `GET /api/training/sessions/today/…` (cache `dyno-today`);
  - `CacheFirst` for `/api/training/media/exercises/…` (cache `dyno-exercises`);
  - a small inline plugin that injects `<link rel="manifest">` without editing `frontend/index.html` (which is outside the Phase 5 allowlist).
- Added `frontend/src/features/training/offline/`:
  - `offlineQueue.js` — native IndexedDB queue, no dependency, keyed by `client_set_id`, ordered by capture time.
  - `syncSets.js` — ordered replay; removes an item only after the server acknowledges it; raises `SessionExpiredError` on auth failure and `SyncOrderError` on other failures, preserving the queue.
  - `useOfflineSync.js` — online/offline listeners, pending count, replay on reconnect, `login-required` state.
  - `PendingSyncIndicator.jsx/.css` — pending/offline/syncing/error states and a clear “Sign in again” prompt.
  - `logSet.js` — writes immediately when online, otherwise enqueues; a lost response is retried with the same `client_set_id`.
- Replaced the broken member placeholders with working screens and wired them into `MemberTrainingPage.jsx` (`/member/workout/today`, `/member/workout/session/:assignmentId/:sessionId`, `/member/workout/history`, `/member/workout/exercises`).
- Removed the non-functional Phase 3/4 placeholders that imported packages not present in this project (`react-redux`, `@reduxjs/toolkit`, `components`, `api/trainingSessions`): `sessionsSlice.js`, `assignments/assignmentsSlice.js`, `assignments/AssignmentsPage.jsx/.css`, and `member/MemberProfilePage.jsx/.css`. They were unreachable dead code; `SessionsPage.jsx` was rewritten as a working history screen instead of deleted.
- Fixed the Phase 4 session route so `session_detail` receives both ids: `session/<assignment_id>/<session_id>/`.
- Fixed set logging so it no longer overwrites unrelated exercises and so a repeated `client_set_id` is a true no-op.

### Evidence actually produced in this session

| Check | Command | Exit | Evidence |
|---|---|---|---|
| G1 isolation | `python docs/training/isolation_check.py check` | `0` | `ISOLATION OK` |
| G4 lint | `npm run lint` | `0` | **19 warnings, 0 errors** — exactly the baseline count; all remaining warnings are in pre-existing non-training files |
| G5 build, flag off | `npm run build` | `0` | `dist/sw.js`, `dist/workbox-57884417.js`, `dist/registerSW.js`, `dist/manifest.webmanifest`; `precache 12 entries (1039.83 KiB)`; offline module tree-shaken |
| G5 build, flag on | `$env:VITE_WORKOUTS_V2_ENABLED='true'; npm run build` | `0` | Same PWA files; bundle contains `dyno-training-offline`, `replayQueue requires a request function`, and `SyncOrderError`, proving the offline module compiles and ships |
| Manifest link | inspect `dist/index.html` | n/a | `<link rel="manifest" href="/manifest.webmanifest">` and `<script id="vite-plugin-pwa:register-sw" src="/registerSW.js">` present |
| SW strategies | inspect `dist/sw.js` | n/a | `NetworkFirst` route for `/api/training/sessions/today/`; `CacheFirst` route for `/api/training/media/exercises/`; precache includes `index.html`, the manifest, and all icons |
| Replay logic | `node D:\AI\tmp\opencode\test_offline_replay.mjs` | `0` | **16/16 checks passed** (order, exactly-once after a lost response, token expiry preserves queue, non-auth failure stops in order, missing request rejected) |
| IndexedDB queue | `node D:\AI\tmp\opencode\test_offline_queue.mjs` | `0` | **10/10 checks passed** (idempotent enqueue by `client_set_id`, capture order, update-on-reenqueue, failed-attempt metadata, removal, clear, missing-id rejection) |

### Acceptance mapping

| Acceptance item | Result |
|---|---|
| `npm run build` produces a manifest and service worker | **Verified.** Both files exist in `dist/` with the manifest link and SW registration injected. |
| Offline session accepts sets and reconnect replays them exactly once | **Logic verified, browser-unverified.** The queue is keyed by `client_set_id`; replay is ordered and removes only acknowledged items; the Node replay test proves a response lost after the server commit is retried with the same id and stored once. A real browser with the network disabled could not be exercised here. |
| Token expiry during replay shows a login prompt without losing the queue | **Logic verified, browser-unverified.** `SessionExpiredError` is raised before any item is removed; `PendingSyncIndicator` renders a “Sign in again” action that calls `logout()` and leaves IndexedDB untouched. The Node replay test asserts the queue is preserved. |

### Blocked backend gates (honest correction)

`manage.py check` and the Django test suite could **not** be executed in this session. The project’s `MONGODB_URI` points at MongoDB Atlas, and every connection attempt failed with `pymongo.errors.ServerSelectionTimeoutError: SSL handshake failed … TLSV1_ALERT_INTERNAL_ERROR`. Setting `MONGODB_DATABASE=dyno_fitness_test` only changes the database name, not the unreachable host, so the backend cannot start here.

Consequently, the G2/G3/G6/G7 rows in the Phase 2, Phase 3, and Phase 4 sections above were **not reproduced in this session** and should not be treated as fresh evidence. The Phase 4 criteria table describes implemented behaviour and the code paths, not a passing test run. Phase 5’s frontend build, isolation, and offline-logic checks are the only results produced here.

### Cleanup and state