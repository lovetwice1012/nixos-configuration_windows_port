#!/usr/bin/env python3
import sqlite3
import json
import os
import argparse
import calendar
import re
from datetime import date, timedelta

DB_PATH = os.path.expanduser("~/.local/share/focustime/focustime.db")

DESKTOP_CACHE_NAME = {}
DESKTOP_CACHE_ICON = {}
CACHE_BUILT = False

def get_xdg_search_dirs():
    search_dirs = []
    xdg_data_home = os.environ.get("XDG_DATA_HOME", os.path.expanduser("~/.local/share"))
    search_dirs.append(os.path.join(xdg_data_home, "applications"))
    
    xdg_data_dirs = os.environ.get("XDG_DATA_DIRS", "/usr/local/share:/usr/share")
    for d in xdg_data_dirs.split(":"):
        if d.strip():
            search_dirs.append(os.path.join(d, "applications"))

    fallback_dirs = [
        "/var/lib/flatpak/exports/share/applications",
        "/var/lib/snapd/desktop/applications"
    ]
    for d in fallback_dirs:
        if d not in search_dirs:
            search_dirs.append(d)
    return search_dirs

def build_desktop_cache():
    global CACHE_BUILT
    if CACHE_BUILT: return
    
    for directory in get_xdg_search_dirs():
        if not os.path.exists(directory): continue
        try:
            for f in os.listdir(directory):
                if f.endswith(".desktop"):
                    path = os.path.join(directory, f)
                    try:
                        name, icon, wmclass = None, "", None
                        with open(path, 'r', encoding='utf-8') as file:
                            for line in file:
                                line = line.strip()
                                if line.startswith("Name=") and not name:
                                    name = line.split("=", 1)[1].strip()
                                elif line.startswith("Icon=") and not icon:
                                    icon = line.split("=", 1)[1].strip()
                                elif line.startswith("StartupWMClass="):
                                    wmclass = line.split("=", 1)[1].strip().lower()
                        
                        if name:
                            base = f[:-8].lower()
                            
                            DESKTOP_CACHE_NAME[base] = name
                            DESKTOP_CACHE_ICON[base] = icon
                            
                            DESKTOP_CACHE_NAME[name.lower()] = name
                            DESKTOP_CACHE_ICON[name.lower()] = icon

                            if wmclass:
                                DESKTOP_CACHE_NAME[wmclass] = name
                                DESKTOP_CACHE_ICON[wmclass] = icon
                            parts = base.split('.')
                            if len(parts) > 1:
                                DESKTOP_CACHE_NAME[parts[-1]] = name
                                DESKTOP_CACHE_ICON[parts[-1]] = icon
                    except Exception:
                        pass
        except Exception:
            pass
    CACHE_BUILT = True

def get_app_icon(app_class):
    if not app_class or app_class == "Unknown": return ""
    build_desktop_cache()
    
    app_class_lower = app_class.lower()
    base_class = re.sub(r'[-_ ]?updater$', '', app_class_lower)
    base_class = base_class.replace('.exe', '')

    if app_class_lower in DESKTOP_CACHE_ICON:
        return DESKTOP_CACHE_ICON[app_class_lower]
    if base_class in DESKTOP_CACHE_ICON:
        return DESKTOP_CACHE_ICON[base_class]
    return ""

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("date", nargs="?", default=date.today().isoformat())
    parser.add_argument("--app", type=str, default=None, help="Filter stats by app_class")
    args = parser.parse_args()

    target_date_str = args.date
    app_filter = args.app

    try:
        target_date = date.fromisoformat(target_date_str)
    except ValueError:
        target_date = date.today()

    if not os.path.exists(DB_PATH):
        print(json.dumps({
            "total": 0, "average": 0, "week_range": "", "yesterday": 0, "current": "History", 
            "apps": [], "week": [], "month": [], "hourly": [0]*48
        }))
        return

    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    filter_sql = " AND app_class = ?" if app_filter else ""
    params = (target_date.isoformat(), app_filter) if app_filter else (target_date.isoformat(),)

    yesterday = target_date - timedelta(days=1)
    params_y = (yesterday.isoformat(), app_filter) if app_filter else (yesterday.isoformat(),)
    c.execute(f'SELECT SUM(seconds) FROM focus_log WHERE log_date = ?{filter_sql}', params_y)
    yesterday_seconds = c.fetchone()[0] or 0

    # Calculate Weekly Average and Dates
    monday = target_date - timedelta(days=target_date.weekday())
    sunday = monday + timedelta(days=6)
    week_range_str = f"{monday.strftime('%b')} {monday.day} - {sunday.strftime('%b')} {sunday.day}"

    params_avg = (monday.isoformat(), sunday.isoformat(), app_filter) if app_filter else (monday.isoformat(), sunday.isoformat())
    c.execute(f'''
        SELECT COUNT(DISTINCT log_date), SUM(seconds) 
        FROM focus_log 
        WHERE log_date >= ? AND log_date <= ? AND seconds > 0 {filter_sql}
    ''', params_avg)
    row = c.fetchone()
    days_count = row[0] or 0
    total_week = row[1] or 0
    average_seconds = total_week // days_count if days_count > 0 else 0

    c.execute(f'SELECT SUM(seconds) FROM focus_log WHERE log_date = ?{filter_sql}', params)
    total_seconds = c.fetchone()[0] or 0

    c.execute(f'''
        SELECT app_class, COALESCE(app_title, app_class), SUM(seconds) as secs 
        FROM focus_log 
        WHERE log_date = ?{filter_sql}
        GROUP BY app_class
        ORDER BY secs DESC 
    ''', params)
    
    all_apps = []
    for row in c.fetchall():
        app_class, app_title, secs = row
        percentage = (secs / total_seconds) * 100 if total_seconds > 0 else 0
        icon_str = get_app_icon(app_class)
        all_apps.append({
            "class": app_class,
            "name": app_title,
            "icon": icon_str,
            "seconds": secs,
            "percent": round(percentage, 1)
        })
    
    monday_iter = target_date - timedelta(days=target_date.weekday())
    days_str = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    week_data = []
    
    for i in range(7):
        d = monday_iter + timedelta(days=i)
        p = (d.isoformat(), app_filter) if app_filter else (d.isoformat(),)
        c.execute(f'SELECT SUM(seconds) FROM focus_log WHERE log_date = ?{filter_sql}', p)
        tot = c.fetchone()[0] or 0
        week_data.append({"date": d.isoformat(), "day": days_str[i], "total": tot, "is_target": d == target_date})

    month_data = []
    _, num_days = calendar.monthrange(target_date.year, target_date.month)
    first_day = target_date.replace(day=1)
    weekday_of_1st = first_day.weekday()

    for _ in range(weekday_of_1st):
        month_data.append({"date": "", "total": -1, "is_target": False})

    for i in range(1, num_days + 1):
        d = target_date.replace(day=i)
        p = (d.isoformat(), app_filter) if app_filter else (d.isoformat(),)
        c.execute(f'SELECT SUM(seconds) FROM focus_log WHERE log_date = ?{filter_sql}', p)
        tot = c.fetchone()[0] or 0
        month_data.append({"date": d.isoformat(), "total": tot, "is_target": d == target_date})

    hourly_data = [0] * 48
    
    try:
        c.execute(f'SELECT hour, SUM(seconds) FROM focus_hourly WHERE log_date = ?{filter_sql} GROUP BY hour', params)
        for row in c.fetchall():
            hr, secs = row
            if 0 <= hr <= 23:
                hourly_data[hr * 2] += secs
    except sqlite3.OperationalError:
        pass

    try:
        c.execute(f'SELECT interval_idx, SUM(seconds) FROM focus_intervals WHERE log_date = ?{filter_sql} GROUP BY interval_idx', params)
        for row in c.fetchall():
            idx, secs = row
            if 0 <= idx < 96:
                hourly_data[idx // 2] += secs
    except sqlite3.OperationalError:
        pass

    result = {
        "selected_date": target_date.isoformat(),
        "total": total_seconds,
        "average": average_seconds,
        "week_range": week_range_str,
        "yesterday": yesterday_seconds,
        "current": app_filter if app_filter else "History",
        "apps": all_apps,
        "week": week_data,
        "month": month_data,
        "hourly": hourly_data
    }
    
    print(json.dumps(result))

if __name__ == "__main__":
    main()
