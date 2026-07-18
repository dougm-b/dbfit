#!/usr/bin/env python3
"""
Extracts daily bioimpedância history from an Android Health Connect SQLite
export (health_connect_export.db, found inside the "Health Connect.zip"
the app can produce) and merges it into data/db.json's state.healthHistory.

Health Connect does not track gordura visceral, proteína corporal, or idade
corporal, so those fields (and altura) are left untouched for any date —
only the fields Health Connect actually provides are overwritten:
peso, gc, musc (lean body mass — the closest available proxy for "músculo
total", not pure skeletal muscle mass, since Health Connect doesn't expose
that separately), agua, met, fc (resting heart rate), passos, ossea.

Usage:
    python3 scripts/import_health_connect.py <path-to-db-or-zip> [--dry-run]

Run from the repo root. Writes directly to data/db.json; commit separately.
"""
import sys
import sqlite3
import json
import zipfile
import tempfile
import os
import datetime
from pathlib import Path

EPOCH = datetime.date(1970, 1, 1)
REPO_ROOT = Path(__file__).resolve().parent.parent
DB_JSON_PATH = REPO_ROOT / 'data' / 'db.json'


def epoch_day_to_iso(local_date):
    return (EPOCH + datetime.timedelta(days=local_date)).isoformat()


def latest_per_day(conn, table, value_col):
    """Returns {iso_date: value} using the most recent `time` reading per local_date."""
    cur = conn.cursor()
    cur.execute(f"""
        SELECT local_date, {value_col}
        FROM {table} t1
        WHERE time = (SELECT MAX(time) FROM {table} t2 WHERE t2.local_date = t1.local_date)
    """)
    out = {}
    for local_date, value in cur.fetchall():
        if value is None:
            continue
        out[epoch_day_to_iso(local_date)] = value
    return out


def steps_per_day(conn):
    cur = conn.cursor()
    cur.execute("SELECT local_date, SUM(count) FROM steps_record_table GROUP BY local_date")
    out = {}
    for local_date, total in cur.fetchall():
        if total is None:
            continue
        out[epoch_day_to_iso(local_date)] = int(total)
    return out


def fmt_kg(grams):
    return f"{grams/1000:.1f}".replace('.', ',') + ' kg'


def fmt_pct(v):
    return f"{v:.1f}".replace('.', ',') + '%'


def fmt_kcal(n):
    return f"{round(n):,}".replace(',', '.')


def extract(db_path):
    conn = sqlite3.connect(db_path)

    weight = latest_per_day(conn, 'weight_record_table', 'weight')          # grams
    body_fat = latest_per_day(conn, 'body_fat_record_table', 'percentage')  # %
    lean_mass = latest_per_day(conn, 'lean_body_mass_record_table', 'mass') # grams
    bone_mass = latest_per_day(conn, 'bone_mass_record_table', 'mass')      # grams
    water_mass = latest_per_day(conn, 'body_water_mass_record_table', 'body_water_mass')  # grams
    bmr_watts = latest_per_day(conn, 'basal_metabolic_rate_record_table', 'basal_metabolic_rate')  # watts
    resting_hr = latest_per_day(conn, 'resting_heart_rate_record_table', 'beats_per_minute')  # bpm
    steps = steps_per_day(conn)

    conn.close()

    all_dates = set(weight) | set(body_fat) | set(lean_mass) | set(bone_mass) \
        | set(water_mass) | set(bmr_watts) | set(resting_hr) | set(steps)

    records = {}
    for date in all_dates:
        rec = {}
        if date in weight:
            rec['peso'] = fmt_kg(weight[date])
        if date in body_fat:
            rec['gc'] = fmt_pct(body_fat[date])
        if date in lean_mass:
            rec['musc'] = fmt_kg(lean_mass[date])
        if date in bone_mass:
            rec['ossea'] = fmt_kg(bone_mass[date])
        if date in water_mass and date in weight and weight[date]:
            rec['agua'] = fmt_pct(water_mass[date] / weight[date] * 100)
        if date in bmr_watts:
            rec['met'] = fmt_kcal(bmr_watts[date] * 86400 / 4184)
        if date in resting_hr:
            rec['fc'] = int(resting_hr[date])
        if date in steps:
            rec['passos'] = steps[date]
        if rec:
            records[date] = rec
    return records


def merge_into_db_json(records, dry_run=False):
    with open(DB_JSON_PATH, 'r', encoding='utf-8') as f:
        state = json.load(f)

    if 'healthHistory' not in state:
        state['healthHistory'] = {}

    changed_dates = []
    for date in sorted(records):
        rec = records[date]
        existing = state['healthHistory'].get(date, {})
        before = dict(existing)
        existing.update(rec)
        # Preserve altura from current app state if this is a brand-new date entry
        existing.setdefault('altura', state.get('health', {}).get('altura', 184))
        state['healthHistory'][date] = existing
        if existing != before:
            changed_dates.append(date)

    # Refresh the "current" health mirror field-by-field, each from the most
    # recent date that actually has a reading for it (not a single latest
    # date wholesale — a day with only steps/FC shouldn't blank out a more
    # recent weight reading from an earlier day). gv/prot/idade aren't
    # sourced from Health Connect at all and are left untouched.
    dates_desc = sorted(state['healthHistory'].keys(), reverse=True)
    for field in ('peso', 'gc', 'musc', 'agua', 'met', 'fc', 'passos', 'ossea'):
        for d in dates_desc:
            if field in state['healthHistory'][d]:
                state['health'][field] = state['healthHistory'][d][field]
                break
    latest_date = dates_desc[0] if dates_desc else None

    if not dry_run:
        with open(DB_JSON_PATH, 'w', encoding='utf-8') as f:
            json.dump(state, f, ensure_ascii=False, indent=2)
            f.write('\n')

    return changed_dates, latest_date


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    src = sys.argv[1]
    dry_run = '--dry-run' in sys.argv

    db_path = src
    tmpdir = None
    if src.lower().endswith('.zip'):
        tmpdir = tempfile.mkdtemp()
        with zipfile.ZipFile(src) as zf:
            zf.extractall(tmpdir)
        candidates = list(Path(tmpdir).rglob('*.db'))
        if not candidates:
            print('No .db file found inside zip'); sys.exit(1)
        db_path = str(candidates[0])

    records = extract(db_path)
    print(f"Extracted {len(records)} daily records from {db_path}")
    changed_dates, latest_date = merge_into_db_json(records, dry_run=dry_run)
    print(f"{'Would update' if dry_run else 'Updated'} {len(changed_dates)} date(s) in healthHistory")
    if changed_dates:
        print(f"  range: {changed_dates[0]} .. {changed_dates[-1]}")
    print(f"Latest date now mirrored into state.health: {latest_date}")

    if tmpdir:
        import shutil
        shutil.rmtree(tmpdir, ignore_errors=True)


if __name__ == '__main__':
    main()
