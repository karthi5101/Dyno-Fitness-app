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
