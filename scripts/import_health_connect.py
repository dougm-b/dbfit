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
that separately), agua, met, fc (resting heart rate), passos, ossea,
fcmed/fcmax (continuous heart-rate series min/avg/max per day), gasto
(total calories burned) and gastoativo (exercise calories). Sleep sessions
(duration, stage totals, and the night's stage timeline for the hypnogram)
go into state.sleepHistory.

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


SLEEP_STAGE_KEYS = {1: 'awake', 4: 'light', 5: 'deep', 6: 'rem'}
# codes used inside db.json's compact stage timeline: [offsetMin, durMin, code]
SLEEP_STAGE_CODES = {'light': 'l', 'deep': 'd', 'rem': 'r', 'awake': 'a'}


def _fmt_hhmm(epoch_ms, zone_offset_s):
    t = datetime.datetime.utcfromtimestamp(epoch_ms / 1000 + (zone_offset_s or 0))
    return t.strftime('%H:%M')


def sleep_per_day(conn):
    """Returns {iso_date: {duration, light, deep, rem, awake, start, end, stages}},
    summing all sleep sessions that wake up (local_date) on the same day, with
    stage minute totals pulled from sleep_stages_table keyed by parent_key.
    start/end (HH:MM) and the stage timeline come from the longest session of
    the day — stages is a compact [[offsetMin, durMin, code], ...] list used by
    the app to draw the night's hypnogram."""
    cur = conn.cursor()
    cur.execute("""
        SELECT row_id, start_time, end_time, local_date,
               COALESCE(start_zone_offset, 0), COALESCE(end_zone_offset, 0)
        FROM sleep_session_record_table
    """)
    sessions = cur.fetchall()
    if not sessions:
        return {}

    cur.execute("SELECT parent_key, stage_start_time, stage_end_time, stage_type FROM sleep_stages_table")
    stage_minutes_by_session = {}
    stage_segments_by_session = {}
    for parent_key, s_start, s_end, s_type in cur.fetchall():
        key = SLEEP_STAGE_KEYS.get(s_type)
        if key is None:
            continue
        minutes = (s_end - s_start) / 60000
        bucket = stage_minutes_by_session.setdefault(parent_key, {})
        bucket[key] = bucket.get(key, 0) + minutes
        stage_segments_by_session.setdefault(parent_key, []).append((s_start, s_end, key))

    longest_by_date = {}
    out = {}
    for row_id, start_time, end_time, local_date, start_off, end_off in sessions:
        date = epoch_day_to_iso(local_date)
        hours = (end_time - start_time) / 3600000
        rec = out.setdefault(date, {'duration': 0, 'light': 0, 'deep': 0, 'rem': 0, 'awake': 0})
        rec['duration'] += hours
        stage_minutes = stage_minutes_by_session.get(row_id, {})
        for key in ('light', 'deep', 'rem', 'awake'):
            rec[key] += stage_minutes.get(key, 0)
        prev = longest_by_date.get(date)
        if prev is None or hours > prev[1]:
            longest_by_date[date] = (row_id, hours, start_time, end_time, start_off, end_off)

    for date, (row_id, _hours, start_time, end_time, start_off, end_off) in longest_by_date.items():
        rec = out[date]
        rec['start'] = _fmt_hhmm(start_time, start_off)
        rec['end'] = _fmt_hhmm(end_time, end_off)
        segments = sorted(stage_segments_by_session.get(row_id, []))
        stages = []
        for s_start, s_end, key in segments:
            offset = round((s_start - start_time) / 60000)
            dur = round((s_end - s_start) / 60000)
            if dur <= 0:
                continue
            stages.append([offset, dur, SLEEP_STAGE_CODES[key]])
        if stages:
            rec['stages'] = stages

    for rec in out.values():
        rec['duration'] = round(rec['duration'], 2)
        for key in ('light', 'deep', 'rem', 'awake'):
            rec[key] = round(rec[key])
    return out


def hr_per_day(conn):
    """Returns {iso_date: (min, avg, max)} from the continuous heart-rate
    series (one reading per minute), joined to its parent record for the
    local_date."""
    cur = conn.cursor()
    cur.execute("""
        SELECT r.local_date, MIN(s.beats_per_minute), AVG(s.beats_per_minute), MAX(s.beats_per_minute)
        FROM heart_rate_record_series_table s
        JOIN heart_rate_record_table r ON s.parent_key = r.row_id
        GROUP BY r.local_date
    """)
    out = {}
    for local_date, mn, avg, mx in cur.fetchall():
        if avg is None:
            continue
        out[epoch_day_to_iso(local_date)] = (int(mn), round(avg), int(mx))
    return out


def calories_per_day(conn, table):
    """Returns {iso_date: kcal} — Health Connect stores energy in calories
    (small cal), so /1000 gives kcal."""
    cur = conn.cursor()
    cur.execute(f"SELECT local_date, SUM(energy) / 1000 FROM {table} GROUP BY local_date")
    out = {}
    for local_date, kcal in cur.fetchall():
        if kcal is None or kcal <= 0:
            continue
        out[epoch_day_to_iso(local_date)] = round(kcal)
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
    sleep = sleep_per_day(conn)
    hr_stats = hr_per_day(conn)
    total_cal = calories_per_day(conn, 'total_calories_burned_record_table')
    active_cal = calories_per_day(conn, 'active_calories_burned_record_table')

    conn.close()

    all_dates = set(weight) | set(body_fat) | set(lean_mass) | set(bone_mass) \
        | set(water_mass) | set(bmr_watts) | set(resting_hr) | set(steps) \
        | set(hr_stats) | set(total_cal) | set(active_cal)

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
        if date in hr_stats:
            rec['fcmed'] = hr_stats[date][1]
            rec['fcmax'] = hr_stats[date][2]
        if date in total_cal:
            rec['gasto'] = fmt_kcal(total_cal[date])
        if date in active_cal:
            rec['gastoativo'] = fmt_kcal(active_cal[date])
        if rec:
            records[date] = rec
    return records, sleep


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
    for field in ('peso', 'gc', 'musc', 'agua', 'met', 'fc', 'passos', 'ossea',
                  'fcmed', 'fcmax', 'gasto', 'gastoativo'):
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


def merge_sleep_into_db_json(sleep_records, dry_run=False):
    with open(DB_JSON_PATH, 'r', encoding='utf-8') as f:
        state = json.load(f)

    if 'sleepHistory' not in state:
        state['sleepHistory'] = {}

    changed_dates = []
    for date in sorted(sleep_records):
        rec = sleep_records[date]
        if state['sleepHistory'].get(date) != rec:
            changed_dates.append(date)
        state['sleepHistory'][date] = rec

    if not dry_run:
        with open(DB_JSON_PATH, 'w', encoding='utf-8') as f:
            json.dump(state, f, ensure_ascii=False, indent=2)
            f.write('\n')

    return changed_dates


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

    records, sleep_records = extract(db_path)
    print(f"Extracted {len(records)} daily bioimpedância records and {len(sleep_records)} daily sleep records from {db_path}")
    changed_dates, latest_date = merge_into_db_json(records, dry_run=dry_run)
    print(f"{'Would update' if dry_run else 'Updated'} {len(changed_dates)} date(s) in healthHistory")
    if changed_dates:
        print(f"  range: {changed_dates[0]} .. {changed_dates[-1]}")
    print(f"Latest date now mirrored into state.health: {latest_date}")

    sleep_changed = merge_sleep_into_db_json(sleep_records, dry_run=dry_run)
    print(f"{'Would update' if dry_run else 'Updated'} {len(sleep_changed)} date(s) in sleepHistory")
    if sleep_changed:
        print(f"  range: {sleep_changed[0]} .. {sleep_changed[-1]}")

    if tmpdir:
        import shutil
        shutil.rmtree(tmpdir, ignore_errors=True)


if __name__ == '__main__':
    main()
