#!/usr/bin/env python3
"""
Extracts body measurements (cintura, peito, anca, bíceps, coxas, ...) from a
Daily Strength app export (daily_strength_YYYY_MM_DD.zip, containing
MeasurementLog.json) and merges them into data/db.json's state.measurements.

Only records with measurementType == 'size' are imported — weight and body-fat
entries in the same file are deliberately ignored, since those come from the
Health Connect bioimpedância pipeline (scripts/import_health_connect.py) and
would conflict with it.

Measurement defs are matched by (translated) name, case-insensitively, so
re-running is idempotent and coexists with cards the user created by hand in
the app. New defs get sequential ids (m1, m2, ...) like the app does.

Usage:
    python3 scripts/import_daily_strength.py <path-to-zip-or-dir> [--dry-run]

Run from the repo root. Writes directly to data/db.json; commit separately.
"""
import sys
import json
import zipfile
import tempfile
import datetime
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DB_JSON_PATH = REPO_ROOT / 'data' / 'db.json'

NAME_PT = {
    'waist': 'Cintura',
    'chest': 'Peito',
    'hips': 'Anca',
    'left bicep': 'Bíceps esquerdo',
    'right bicep': 'Bíceps direito',
    'left thigh': 'Coxa esquerda',
    'right thigh': 'Coxa direita',
    'neck': 'Pescoço',
    'shoulders': 'Ombros',
    'left calf': 'Gémeo esquerdo',
    'right calf': 'Gémeo direito',
    'left forearm': 'Antebraço esquerdo',
    'right forearm': 'Antebraço direito',
}


def load_measurement_log(src):
    path = Path(src)
    if path.is_dir():
        return json.loads((path / 'MeasurementLog.json').read_text(encoding='utf-8'))
    if src.lower().endswith('.zip'):
        with zipfile.ZipFile(src) as zf:
            with zf.open('MeasurementLog.json') as f:
                return json.load(f)
    return json.loads(path.read_text(encoding='utf-8'))


def extract(src):
    """Returns {(name_pt, unit): {iso_date: value}} keeping the latest entry
    per measurement per day."""
    log = load_measurement_log(src)
    out = {}
    latest_ts = {}
    for entry in log:
        m = entry.get('measurement') or {}
        if m.get('measurementType') != 'size':
            continue
        raw_name = (m.get('name') or '').strip()
        if not raw_name or entry.get('value') is None:
            continue
        name = NAME_PT.get(raw_name.lower(), raw_name)
        unit = entry.get('measurementUnit') or 'cm'
        ts = entry.get('date') or 0
        date = datetime.datetime.fromtimestamp(ts / 1000).date().isoformat()
        key = (name, unit)
        if latest_ts.get((key, date), -1) > ts:
            continue
        latest_ts[(key, date)] = ts
        out.setdefault(key, {})[date] = entry['value']
    return out


def merge_into_db_json(records, dry_run=False):
    with open(DB_JSON_PATH, 'r', encoding='utf-8') as f:
        state = json.load(f)

    meas = state.setdefault('measurements', {})
    defs = meas.setdefault('defs', [])
    history = meas.setdefault('history', {})

    def next_id():
        nums = [int(d['id'][1:]) for d in defs if str(d.get('id', '')).startswith('m') and str(d['id'])[1:].isdigit()]
        return 'm' + str(max(nums) + 1 if nums else 1)

    changed = 0
    for (name, unit), by_date in sorted(records.items()):
        existing = next((d for d in defs if d.get('name', '').lower() == name.lower()), None)
        if existing is None:
            existing = {'id': next_id(), 'name': name, 'unit': unit}
            defs.append(existing)
        mid = existing['id']
        for date, value in by_date.items():
            day = history.setdefault(date, {})
            if day.get(mid) != value:
                day[mid] = value
                changed += 1

    if not dry_run:
        with open(DB_JSON_PATH, 'w', encoding='utf-8') as f:
            json.dump(state, f, ensure_ascii=False, indent=2)
            f.write('\n')
    return defs, changed


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    src = sys.argv[1]
    dry_run = '--dry-run' in sys.argv

    records = extract(src)
    n_points = sum(len(v) for v in records.values())
    print(f"Extracted {len(records)} measurement type(s), {n_points} dated value(s) from {src}")
    for (name, unit), by_date in sorted(records.items()):
        dates = sorted(by_date)
        print(f"  {name} ({unit}): {len(by_date)} value(s), {dates[0]} .. {dates[-1]}")
    defs, changed = merge_into_db_json(records, dry_run=dry_run)
    print(f"{'Would update' if dry_run else 'Updated'} {changed} value(s); {len(defs)} measurement def(s) total")


if __name__ == '__main__':
    main()
