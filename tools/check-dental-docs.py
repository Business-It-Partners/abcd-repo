#!/usr/bin/env python3
"""Validate the Dental OS documentation contract without opening the application."""
import hashlib
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ARCH = ROOT / 'dental-os_v1-documentation'
WORK = ROOT / 'dental-os_v1_working_info'
REQUIRED = ('PLAN.md', 'STATUS.md', 'IMPLEMENTATION_NOTES.md', 'VERIFICATION_EVIDENCE.md')

def check():
    errors = []
    files = sorted(ARCH.glob('*.md')) + sorted(WORK.glob('*.md'))
    milestones = sorted(WORK.glob('milestone-*'))
    expected_milestone_ids = list(range(1, 21))
    if len(list(ARCH.glob('*.md'))) != 24:
        errors.append('Expected 24 numbered architecture documents')
    if len(milestones) != len(expected_milestone_ids):
        errors.append(f'Expected milestone folders for IDs {expected_milestone_ids}')
    for milestone_id, folder in zip(expected_milestone_ids, milestones):
        if not folder.name.startswith(f'milestone-{milestone_id:02d}-'):
            errors.append(f'Milestone sequence mismatch: {folder.name}')
        for name in REQUIRED:
            path = folder / name
            if not path.is_file():
                errors.append(f'Missing {path.relative_to(ROOT)}')
            else:
                files.append(path)
    files += [ROOT / name for name in ('PRODUCT_DIRECTION.md', 'AGENTS.md')]
    # M16 scoped architecture complements, rather than increases, the numbered V1 document set.
    extra = WORK / 'milestone-16-file-acquisition' / 'ARCHITECTURE.md'
    if not extra.is_file():
        errors.append(f'Missing scoped architecture: {extra.relative_to(ROOT)}')
    else:
        files.append(extra)
    # Check the scoped documents and root authority files; old prototype/history
    # links outside this task are deliberately not reinterpreted as new failures.
    for path in files:
        body = path.read_text(encoding='utf-8')
        if len(body.strip()) < 80:
            errors.append(f'Empty/placeholder document: {path.relative_to(ROOT)}')
        for raw in re.findall(r'(?<!!)\[[^\]]*\]\(([^)]+)\)', body):
            target = raw.strip().split(' "', 1)[0].strip('<>')
            if re.match(r'^[a-zA-Z][a-zA-Z0-9+.-]*:', target) or target.startswith('#'):
                continue
            target = target.split('#', 1)[0]
            if target and not (path.parent / target).exists():
                errors.append(f'Broken link in {path.relative_to(ROOT)}: {target}')
    plans = '\n'.join((p / 'PLAN.md').read_text(encoding='utf-8') for p in milestones if (p / 'PLAN.md').exists())
    trace = (ARCH / '22_V1_REQUIREMENTS_AND_TRACEABILITY.md').read_text(encoding='utf-8')
    gate_doc = (ARCH / '18_V1_ACCEPTANCE_GATES.md').read_text(encoding='utf-8')
    inv = (ARCH / '03_V1_PRINCIPLES_AND_INVARIANTS.md').read_text(encoding='utf-8')
    for n in range(1, 17):
        req = f'R{n:02d}'
        if not re.search(rf'\b{req}\b', plans) or not re.search(rf'\b{req}\b', trace):
            errors.append(f'Unmapped requirement {req}')
    for n in list(range(1, 17)) + [20, 21]:
        gate = f'G{n:02d}'
        if not re.search(rf'\b{gate}\b', plans) or not re.search(rf'\b{gate}\b', gate_doc):
            errors.append(f'Unmapped gate {gate}')
    if not re.search(r'(?m)^\| G15\b', gate_doc):
        errors.append('Missing distinct G15 acceptance-gate row')
    if not re.search(r'(?m)^\| G16\b', gate_doc):
        errors.append('Missing distinct G16 acceptance-gate row')
    r14_row = re.search(r'(?m)^\| R14\b[^\n]*$', trace)
    if not r14_row or not all(marker in r14_row.group(0) for marker in ('G20', 'G21', 'M20')) or 'G15' in r14_row.group(0):
        errors.append('R14 platform release proof must remain mapped to G20/G21 and M20')
    for n in range(1, 15):
        if f'INV-{n:02d}' not in inv:
            errors.append(f'Missing invariant INV-{n:02d}')
    for folder in milestones[1:]:
        status = (folder / 'STATUS.md').read_text(encoding='utf-8')
        if not re.search(r'\*\*Status:\*\* (PLANNED|IMPLEMENTING|IMPLEMENTED|VERIFIED|BLOCKED|DEFERRED|REMOVED)\b', status):
            errors.append(f'Missing valid milestone status: {folder.name}')
    if 'permanent' not in (ARCH / '02_V1_PRODUCT_DEFINITION.md').read_text(encoding='utf-8').lower():
        errors.append('Missing permanent first-party policy')
    # Stable content identity excludes evolving progress/evidence files.
    contract_files = sorted(ARCH.glob('*.md')) + [p / 'PLAN.md' for p in milestones]
    # M16 file-access architecture is a stable contract, not mutable evidence.
    contract_files.append(WORK / 'milestone-16-file-acquisition' / 'ARCHITECTURE.md')
    digest = hashlib.sha256()
    for path in contract_files:
        digest.update(str(path.relative_to(ROOT)).encode())
        digest.update(b'\0' + path.read_bytes() + b'\0')
    dirty_tree = bool(subprocess.check_output(['git', 'status', '--porcelain'], cwd=ROOT, text=True).strip())
    result = {
        'scope': 'documentation links/structure/requirement ownership only; no runtime certification',
        'architecture_documents': 24,
        'milestones': len(milestones),
        'required_milestone_files': len(milestones) * len(REQUIRED),
        'requirements': 16,
        'acceptance_gates': 18,
        'invariants': 14,
        'contract_sha256': digest.hexdigest(),
        'git_head': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
        'working_tree': 'dirty; contract digest identifies authored architecture/plans' if dirty_tree else 'clean',
        'errors': errors,
        'passed': not errors,
    }
    print(json.dumps(result, indent=2))
    return 1 if errors else 0

if __name__ == '__main__':
    raise SystemExit(check())
