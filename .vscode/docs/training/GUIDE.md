# Dyno Fitness: Training Module v2, Agent Build Guide

For a coding agent (Claude Code, Cursor, Codex). Version 1, 31 Oct 2026.

## 0. How to use this guide

- Save this file in the repo as `docs/training/GUIDE.md`.
- First message to the agent: `Read docs/training/GUIDE.md fully, then execute Phase 0 using the Loop Protocol. Do not start the next phase until I say continue.`
- After each phase, reply `continue`. The agent keeps its own state in `docs/training/PROGRESS.md`, so you never repeat context.
- If the agent drifts, reply: `Re-read sections 2 and 3, run the isolation check, fix every violation, then resume.`

## 1. Mission and exact end state

Build a new, isolated workout module called `training`: exercise Library, Program builder, per-member Assignment (Fixed week or Rotation), member Today, session logging, history, and PWA offline logging. It replaces the legacy workout screens through one feature flag.

The finished result must satisfy all of these:

1. Flag off: the app behaves exactly as it does today.
2. Flag on: staff and members use the new module end to end.
3. All existing tests (baseline 54) plus all new tests pass.
4. The isolation check passes: nothing outside the allowlist changed.
5. `docs/training/VERIFICATION.md` exists with commands, exit codes and evidence.

## 2. Hard rules (violating any one means stop and fix)

1. Isolation. Touch only files allowed in section 3. A one-line fix, a rename, or a formatter run elsewhere is a violation. Never run auto-formatters or `eslint --fix` on existing files.
2. Do not modify, delete or move existing tests, the legacy `apps/workouts` app, or any other module (members, attendance, membership, payments, diets, transformations, notes, dashboard, authentication, `uploads.py`).
3. Do not change existing Mongo collections, indexes or the SQLite schema. Create only `trn_*` collections. Create no Django migrations; if Django demands one, stop and report.
4. Tests and servers use database `dyno_fitness_test` only (`MONGODB_DATABASE=dyno_fitness_test`) and a throwaway SQLite. Ports 8000 and 5173 are production: never start, stop or call them. Use 8001 and 5174. Never write production data. Never print secrets or password hashes.
5. No commit, push, stash or branch switch. The working tree already contains uncommitted work; do not clean it.
6. Set `PYTHONDONTWRITEBYTECODE=1` for every python command so tracked `.pyc` files never change.
7. Every new DRF view sets explicit `permission_classes`. Never rely on the global AllowAny default. For member-scoped endpoints, the member id comes from the JWT-linked member, never from the body or URL.
8. Reuse, do not reinvent: existing permission classes (`IsStaffUser`, `IsStaffOrReadOnly`, `MemberScopedAccess`, `StaffOrLinkedMember`, `HasLinkedMember`), the Mongo singleton in `core/database`, and `apiRequest` in `frontend/src/api/client.js`. Import them; never edit them.
9. The UI language is locked. Reuse existing tokens, typography, rounded cards and the black/white/cherry-red palette. Read one existing page and its CSS before building. No new UI library, no new design system.
10. Licensing: copy nothing from openGym (AGPL code, media licensed to openGym only). Library data comes only from free-exercise-db (Unlicense) and staff input.
11. New dependencies only in Phase 5, only those listed there, pinned to exact versions at least 14 days old.

## 3. Allowlist: the only places you may edit

New, free to create:

- `backend/apps/training/**`
- `frontend/src/features/training/**`
- `docs/training/**`

Shared files, additive edits only, caps enforced by the isolation script:

- `backend/config/settings.py`: add the training app to INSTALLED\_APPS (follow the existing style) and read `WORKOUTS_V2_ENABLED` from env, default False. Max +8 lines.
- `backend/api/urls.py`: one unconditional `include` of `apps.training.urls` under prefix `training/`. The module itself returns 404 for every route when the flag is off. Max +4 lines.
- `frontend/src/App.jsx`: swap the routes `/staff/workouts` and `/member/workout` to the new module's entry components, using wildcard child routes (`/staff/workouts/*`, `/member/workout/*`), behind `VITE_WORKOUTS_V2_ENABLED`. Max +16 / -6 lines.
- `frontend/src/pages/staff/MemberProfilePage.jsx`: swap only the workout section slot behind the flag. Max +12 / -6 lines.
- `backend/.env.example`, `frontend/.env.example`: document the flag.
- Phase 5 only: `frontend/package.json`, `frontend/package-lock.json`, `frontend/vite.config.js`, `frontend/public/manifest.webmanifest`, `frontend/public/icons/**`.

No navigation or layout file is on the list. All new screens are reached through the two swapped entry routes using in-module tabs and links. If you believe another file must change, stop and ask.

## 4. Trust and verify

Trust: Django 6.1.1, DRF 3.18.1, PyMongo; Django auth in SQLite, business data in MongoDB; React 19, React Router 7, Vite 8; JWT access token 60 minutes; members linked through `UserMemberProfile`; routes in `frontend/src/App.jsx`; legacy screens in `pages/staff/WorkoutsPage.jsx`, `pages/staff/MemberWorkoutSection.jsx`, `pages/member/WorkoutPage.jsx`, `pages/member/WorkoutHistoryPage.jsx`.

Verify in Phase 0 and record answers in PROGRESS.md (do not assume):

- The exact helper that resolves the current member id from a request.
- How existing repositories obtain the Mongo database handle.
- How existing tests set up and clean the test database.
- Whether any non-workouts module reads `daily_workouts` or `workout_*` collections (grep for them).
- The gym timezone setting. Default to Asia/Kolkata for the gym date.

## 5. Target design

### Collections (all prefixed trn\_)

- `trn_exercises`: slug (unique), name, name\_lc, primary\_muscles\[\], secondary\_muscles\[\], equipment, level, category, instructions\[\], images\[\], video\_file\_id (optional), tracking\_type ('weight\_reps' | 'reps' | 'time'), is\_custom, created\_by, archived.
- `trn_programs`: name, name\_lc, goal, level, days\[\], version, favorite\_by\[\], archived, created\_by, timestamps. Each day: day\_key, label, order, blocks\[\]. Each block: block\_id, exercise\_id, exercise\_name, tracking\_type, notes, sets\[\]. Each set: set\_type ('normal' | 'warmup'), reps\_min, reps\_max, duration\_s, rest\_s.
- `trn_assignments`: member\_id, program\_id, program\_version, program\_copy (deep copy of name and days), mode ('rotation' | 'fixed\_week'), weekday\_map ({mon: day\_key, ...}), pointer (index into days by order), revision, start\_date, status ('active' | 'ended'), created\_by, timestamps.
- `trn_sessions`: assignment\_id, member\_id, session\_date (gym date, YYYY-MM-DD), day\_key, day\_index, day\_snapshot, exercises\[\] (block\_id, exercise\_id, sets\[\] with set\_no, reps, weight\_kg, duration\_s, rpe, done, client\_set\_id), status ('in\_progress' | 'completed' | 'abandoned'), advanced (bool), started\_at, completed\_at, client\_uuid, corrections\[\] (at, by, reason, patch).

### Indexes

- `trn_exercises`: unique slug; index on name\_lc.
- `trn_assignments`: unique on member\_id with partial filter status = active.
- `trn_sessions`: unique on (member\_id, session\_date).

Create indexes in an explicit `ensure_indexes()` called by a management command and by tests. Do not create them lazily on first request.

### Rules (the logic that must hold)

- Today, fixed week: the gym-date weekday looks up `weekday_map`. No entry means rest day.
- Today, rotation: the day at `pointer` is today, and it stays today until finished, however many calendar days pass.
- Start session: idempotent. Creates or returns the session for (member, gym date), copying that day into `day_snapshot`.
- Log sets: merge by `client_set_id`; the same payload sent twice changes nothing. Returns 409 if the session is completed.
- Complete session: atomic update in\_progress to completed. In rotation mode, then advance the pointer with a filter on the expected pointer value and set `advanced` true. A second complete returns `already_completed: true` and never advances again. If a crash left a completed session with `advanced` false, `GET me/today` repairs it by advancing once.
- Abandon: on `GET me/today`, any in\_progress session dated before today becomes `abandoned`; rotation does not advance.
- Completed sessions are immutable. Only staff may append a correction through the corrections endpoint, with a reason; no PUT on completed sessions.
- One active assignment per member. Editing a member's copy never touches the source program. Archiving a program never touches existing copies.
- Programs are archived, never hard-deleted. Limits: at most 7 days, 12 blocks per day, 10 sets per block, reps\_min <= reps\_max, rest 0 to 600 seconds.

### API (prefix /api/training/, all gated by the flag)

- Library: `GET exercises` (q, muscle, equipment, level, category, favorite, cursor, limit up to 50), `GET exercises/{id}`, `POST exercises` and `PATCH exercises/{id}` (staff, custom only), `GET media/exercises/{slug}/{n}` (public read-only images, slug validated, no path traversal, cache headers).
- Programs (staff): `GET/POST programs`, `GET/PUT programs/{id}`, `POST programs/{id}/duplicate`, `POST programs/{id}/archive`.
- Assignment (staff): `GET/POST members/{id}/assignment`, `PATCH members/{id}/assignment` (edit copy, mode, weekday\_map, reset pointer), `POST members/{id}/assignment/end`, `GET members/{id}/history`, `GET members/{id}/adherence`, `POST sessions/{id}/corrections`.
- Member (own data only): `GET me/today`, `GET me/plan`, `POST sessions/start`, `PUT sessions/{id}/sets`, `POST sessions/{id}/complete`, `GET me/history`, `GET me/exercises/{exercise_id}/last`.

## 6. Loop Protocol (this is how you reach the exact result)

For every phase:

1. Write the phase checklist into `docs/training/PROGRESS.md` (each acceptance item as an unchecked line).
2. Implement the smallest slice that could satisfy the first unchecked item.
3. Run the gates below. For speed, run only `apps.training` tests while iterating; run the full suite at the end of the phase.
4. Compare the results with the checklist. If anything fails, fix the first failing item with the smallest change, then go back to step 3.
5. When every gate and every checklist item is green, tick them, record the evidence line (command, exit code, counts) in PROGRESS.md, and stop. Wait for `continue`.

Loop limits: at most 5 fix attempts per failing item. On the 6th failure, stop and report the item, the last error (30 lines max) and your hypothesis. Never weaken, skip or delete a test to make a gate pass. Never mark an item done without running its gate in the same loop.

Regression ratchet: a phase is never done if any earlier phase's tests fail.

### Gates

- G1 Isolation: `python docs/training/isolation_check.py check` must print ISOLATION OK.
- G2 `cd backend && python manage.py check` exits 0.
- G3 Backend tests with `MONGODB_DATABASE=dyno_fitness_test` (PowerShell: `$env:MONGODB_DATABASE='dyno_fitness_test'; $env:PYTHONDONTWRITEBYTECODE='1'; python manage.py test`). Zero failures. Count must be at least baseline + new tests.
- G4 `cd frontend && npm run lint`: zero errors, warnings no higher than the Phase 0 baseline (19 expected).
- G5 `cd frontend && npm run build` exits 0.
- G6 The phase's own acceptance checks (below).
- G7 Flag-off smoke: with the flag off, every `/api/training/` route returns 404, legacy workout routes and the 29 legacy workout tests behave as before, and the frontend legacy routes still render.

### Isolation script (create exactly as `docs/training/isolation_check.py`)

```python
import difflib, json, pathlib, subprocess, sys
ROOT = pathlib.Path(__file__).resolve().parents[2]
D = ROOT / 'docs' / 'training'
SNAP = D / 'baseline.json'
COPY = D / 'baseline_files'
ALLOW = ('backend/apps/training/', 'frontend/src/features/training/', 'docs/training/', 'frontend/public/icons/')
ALLOW_EXACT = {'backend/.env.example', 'frontend/.env.example', 'frontend/package-lock.json', 'frontend/public/manifest.webmanifest'}
SHARED = {  # path: (max added lines, max removed lines)
    'backend/config/settings.py': (8, 0), 'backend/api/urls.py': (4, 0),
    'frontend/src/App.jsx': (16, 6), 'frontend/src/pages/staff/MemberProfilePage.jsx': (12, 6),
    'frontend/package.json': (4, 0), 'frontend/vite.config.js': (20, 2)}

def git(args, inp=None):
    return subprocess.run(['git'] + args, cwd=ROOT, input=inp, capture_output=True, text=True, check=True).stdout

def hashes():
    fs = [f for f in git(['ls-files', '-co', '--exclude-standard']).split(chr(10)) if f and (ROOT / f).is_file() and not f.startswith('docs/training/')]
    return dict(zip(fs, git(['hash-object', '--stdin-paths'], chr(10).join(fs)).split()))

def lines(p):
    return p.read_text(encoding='utf-8', errors='replace').splitlines()

def snapshot():
    D.mkdir(parents=True, exist_ok=True)
    COPY.mkdir(exist_ok=True)
    SNAP.write_text(json.dumps(hashes()))
    for f in SHARED:
        if (ROOT / f).exists():
            (COPY / f.replace('/', '__')).write_text(chr(10).join(lines(ROOT / f)), encoding='utf-8')
    print('snapshot saved')

def check():
    base, now, bad = json.loads(SNAP.read_text()), hashes(), []
    for f, h in now.items():
        if base.get(f) == h or f.startswith(ALLOW) or f in ALLOW_EXACT:
            continue
        if f in SHARED:
            cp = COPY / f.replace('/', '__')
            old = lines(cp) if cp.exists() else []
            diff = list(difflib.unified_diff(old, lines(ROOT / f), lineterm='', n=0))
            add = sum(1 for l in diff if l.startswith('+') and not l.startswith('+++'))
            rem = sum(1 for l in diff if l.startswith('-') and not l.startswith('---'))
            if add > SHARED[f][0] or rem > SHARED[f][1]:
                bad.append(f + ': +' + str(add) + ' -' + str(rem) + ' exceeds cap ' + str(SHARED[f]))
        else:
            bad.append(f + (': modified, not allowed' if f in base else ': new file not allowed'))
    bad += [f + ': deleted' for f in base if f not in now]
    print(chr(10).join(bad) or 'ISOLATION OK')
    sys.exit(1 if bad else 0)

{'snapshot': snapshot, 'check': check}[sys.argv[1]]()
```

Run `python docs/training/isolation_check.py snapshot` once, before any other edit, in Phase 0. Never re-run snapshot afterwards.

## 7. Phases

### Phase 0: Baseline and scaffold

1. Create `docs/training/isolation_check.py` and run `snapshot`. Do this before anything else.
2. Recon (section 4). Record the answers.
3. Run G2 to G5 untouched and record baseline numbers: test count (expect 54), lint warnings (expect 19), build status.
4. Scaffold `backend/apps/training/` (apps.py, urls.py, flag.py, `ensure_indexes`, tests package). `flag.py` raises 404 for every training view when `WORKOUTS_V2_ENABLED` is false. Add the health route.
5. Attach: settings, urls, env examples.

Acceptance: baseline recorded; `GET /api/training/health/` is 200 with the flag on and 404 with it off (test using override\_settings); G1 to G5 and G7 green.

### Phase 1: Library

Targets: `apps/training/library/**`, `seed/`, `management/commands/seed_training_library.py`, `features/training/library/**`.

1. Download `exercises.json` from the yuhonas/free-exercise-db repository into `seed/` with a short LICENSE note (Unlicense). The seed command upserts by slug and is idempotent. Map category and equipment to `tracking_type` (cardio and stretching to 'time', body-only to 'reps', else 'weight\_reps').
2. Copy the first image per exercise to `backend/apps/training/media/exercises/<slug>/0.jpg` and serve it through the media endpoint. If the total exceeds 150 MB, keep only the first image and note it in PROGRESS.md.
3. Library endpoints per section 5. Members read only; staff create and patch custom exercises only (system rows are read-only).
4. Frontend: the entry route `/staff/workouts` renders tabs Library and Programs. Library has a debounced search (300 ms), three filter chip rows (muscle, equipment, level), thumbnail rows, a detail view and a custom exercise form. Members get a read-only Exercises view inside `/member/workout/exercises`.

Acceptance: the seed runs twice with identical counts, against `dyno_fitness_test` only; tests for search, each filter, cursor paging, staff-only writes, system row immutability, member read-only access and media path traversal rejection; screens render with the flag on and nothing changes with it off.

Never run the seed against production. Print the exact production seed command for the human to run after approval.

### Phase 2: Programs

Targets: `apps/training/programs/**`, `features/training/programs/**`.

1. Models, validation (limits in section 5), endpoints, duplicate and archive.
2. Builder UI: day list with reorder, exercise picker bottom sheet that reuses the Library list, a sets table with rep ranges, rest and notes, duplicate day, duplicate program.
3. Seed four original starter programs (PPL 3-day, Upper/Lower 4-day, Full Body 3-day, 5x5 3-day) by exercise slug. The seed fails loudly if a slug is missing.

Acceptance: tests for validation limits, versioning on update, duplicate independence, archive hides from lists, staff-only access; builder creates a program end to end in the browser against test servers.

### Phase 3: Assignment

Targets: `apps/training/assignments/**`, `features/training/assignments/**`, the member profile slot.

1. Assign: deep copy the program, choose mode, weekday\_map or pointer start, start\_date. One active assignment per member (partial unique index).
2. Edit the member's copy, change mode, reset pointer, end assignment.
3. Member profile section (staff): current assignment, assign or change, edit copy, recent sessions, adherence this week.

Acceptance: tests for the unique active assignment, copy independence both ways, mode switching, pointer reset, assigning to a missing or inactive member, staff-only access, and archive-after-assign leaving copies intact.

### Phase 4: Member Today, session and history

Targets: `apps/training/sessions/**`, `features/training/member/**`.

1. Implement the rules in section 5 exactly.
2. Screens: Today (day name, muscle chips, exercise list, Start or Resume or Rest day), Session (one exercise at a time, sets table with last values pre-filled, client-side rest timer, Finish), My plan (read-only), History, Exercises.

Acceptance tests (all required): fixed week resolves by weekday; rest day; rotation stays on the same day across skipped days; complete advances once; double complete returns already\_completed and does not advance twice; crash repair advances once; set sync retried with the same client\_set\_id is a no-op; abandoned rollover; completed session rejects set updates with 409; member cannot read or write another member's data; inactive member is blocked; staff correction appends and never edits history.

### Phase 5: PWA and offline logging

Targets: `features/training/offline/**`, `frontend/public/manifest.webmanifest`, `frontend/public/icons/**`, `vite.config.js`, `package.json`.

1. Add `vite-plugin-pwa` (exact version, at least 14 days old). Manifest with name Dyno Fitness, standalone display, icons.
2. Service worker: precache the app shell; network-first for `GET me/today`; cache-first for library images.
3. Offline set logging: a small native IndexedDB queue (no extra dependency) keyed by `client_set_id`; replay in order when online; show a pending-sync indicator.

Acceptance: `npm run build` produces a manifest and service worker; with the network disabled, a started session accepts sets, and after reconnect the queued sets appear on the server exactly once; token expiry during replay surfaces a clear login prompt without losing the queue.

### Phase 6: Final verification

1. Full gates G1 to G7 from a clean state.
2. Start test servers on 8001 and 5174 with `dyno_fitness_test`, a throwaway SQLite, a temporary staff account and two temporary members. Run these scenarios in the browser or through the API and record each as browser-tested, API-tested, unverified or blocked:
   - Staff seeds and searches the Library, adds a custom exercise.
   - Staff builds a program, assigns it in rotation mode to member A, and in fixed week mode to member B.
   - Member A: Today, start, log sets, finish; Today now shows the next day. Skip two calendar days; Today still shows the same next day.
   - Member B: weekday workout and a rest day.
   - Offline logging and replay.
   - Member A cannot see member B's data.
   - Flag off: legacy screens and routes work as before.
3. Clean up: drop test collections, remove temporary accounts and fixtures, stop test servers, confirm production servers and production counts were never touched.
4. Write `docs/training/VERIFICATION.md` with exact commands, exit codes and evidence per scenario.
5. Run the isolation check one last time.

The work is DONE only if every gate and scenario is green. Otherwise report what is blocked and why.

## 8. Token economy

- Read only files named in the current phase's targets. Use grep to locate things before opening a file; open with line ranges.
- Never print full test or build output. Show at most the last 30 lines, or only the failing test names.
- Never re-read a file you just wrote. Never rewrite a whole file to change a few lines; use targeted edits.
- Batch related edits into one step. Do not paste diffs or full files into chat.
- Status updates are one or two lines. Details go into PROGRESS.md, not the chat.
- Do not explore the legacy `apps/workouts` code beyond what is needed to confirm independence.

## 9. Stop and ask the human when

- A change would require a file outside the allowlist or exceed a cap.
- An existing test fails and your change did not cause it.
- Anything needs production data, production credentials or a production server.
- A licensing question appears (data, images or code sources).
- The same item fails five fix attempts.
- Another module is found reading legacy workout collections.

## 10. Final report template (reply with exactly this)

```
PHASE: <n> STATUS: DONE | BLOCKED
Gates: G1 ok, G2 ok, G3 <pass count>/<total>, G4 <errors>/<warnings>, G5 ok, G6 ok, G7 ok
New tests: <count>. Baseline tests intact: yes/no
Isolation: ISOLATION OK
Files added: <count>. Shared files touched: <list with +/- lines>
Blocked or unverified: <list or none>
Next: wait for continue
```
