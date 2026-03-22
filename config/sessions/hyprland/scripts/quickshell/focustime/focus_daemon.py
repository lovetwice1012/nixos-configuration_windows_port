#!/usr/bin/env python3
import subprocess
import sqlite3
import time
import os
import socket
import json
import threading
import calendar
import re
from datetime import date, datetime, timedelta

current_app_class = "Desktop"
current_app_title = "Desktop"

DB_DIR = os.path.expanduser("~/.local/share/focustime")
os.makedirs(DB_DIR, exist_ok=True)
DB_PATH = os.path.join(DB_DIR, "focustime.db")

XDG_RUNTIME = os.environ.get("XDG_RUNTIME_DIR", "/tmp")
STATE_FILE = os.path.join(XDG_RUNTIME, "focustime_state.json")

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

def resolve_app_name(app_class, raw_title):
    if not app_class or app_class == "Unknown":
        return "Unknown"
        
    build_desktop_cache()
    app_class_lower = app_class.lower()
    base_class = re.sub(r'[-_ ]?updater$', '', app_class_lower)
    base_class = base_class.replace('.exe', '')

    if app_class_lower in DESKTOP_CACHE_NAME:
        return DESKTOP_CACHE_NAME[app_class_lower]
    if base_class in DESKTOP_CACHE_NAME:
        return DESKTOP_CACHE_NAME[base_class]

    clean_title = re.sub(r'^\(\d+\)\s*|^\[\d+\]\s*', '', raw_title)
    clean_title = re.sub(r'\s*\(\d+\)$', '', clean_title)
    
    parts = re.split(r'\s+[-—|]\s+', clean_title)
    name = parts[-1].strip() if len(parts) > 1 else clean_title.strip()

    if len(name) > 25:
        name = app_class.capitalize()

    DESKTOP_CACHE_NAME[app_class_lower] = name
    return name

def get_app_icon(app_class):
    if not app_class or app_class == "Unknown":
        return ""
        
    build_desktop_cache()
    app_class_lower = app_class.lower()
    base_class = re.sub(r'[-_ ]?updater$', '', app_class_lower)
    base_class = base_class.replace('.exe', '')

    if app_class_lower in DESKTOP_CACHE_ICON:
        return DESKTOP_CACHE_ICON[app_class_lower]
    if base_class in DESKTOP_CACHE_ICON:
        return DESKTOP_CACHE_ICON[base_class]

    return ""

def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS focus_log (
            log_date TEXT,
            app_class TEXT,
            seconds INTEGER,
            app_title TEXT,
            PRIMARY KEY (log_date, app_class)
        )
    ''')
    c.execute('CREATE INDEX IF NOT EXISTS idx_log_date ON focus_log(log_date)')
    
    c.execute('''
        CREATE TABLE IF NOT EXISTS focus_hourly (
            log_date TEXT,
            hour INTEGER,
            app_class TEXT,
            seconds INTEGER,
            PRIMARY KEY (log_date, hour, app_class)
        )
    ''')

    c.execute('''
        CREATE TABLE IF NOT EXISTS focus_intervals (
            log_date TEXT,
            interval_idx INTEGER,
            app_class TEXT,
            seconds INTEGER,
            PRIMARY KEY (log_date, interval_idx, app_class)
        )
    ''')
    
    c.execute("PRAGMA table_info(focus_log)")
    columns = [row[1] for row in c.fetchall()]
    if 'app_title' not in columns:
        c.execute('ALTER TABLE focus_log ADD COLUMN app_title TEXT')
        
    conn.commit()
    return conn

def get_active_window_hyprctl():
    try:
        output = subprocess.check_output(['hyprctl', 'activewindow', '-j'], text=True)
        if output.strip() == "{}": return "Desktop", "Desktop"
        data = json.loads(output)
        
        app_cls = data.get('initialClass') or data.get('class') or ''
        raw_title = data.get('initialTitle') or data.get('title') or ''

        if "quickshell" in app_cls.lower() or "qs-master" in raw_title.lower() or "qs-master" in app_cls.lower():
            return "Quickshell", "Quickshell"
            
        app_cls = app_cls if app_cls else "Unknown"
        raw_title = raw_title if raw_title else app_cls
        
        clean_name = resolve_app_name(app_cls, raw_title)
        return app_cls, clean_name
    except Exception:
        return "Unknown", "Unknown"

def is_locked():
    try:
        subprocess.check_output(['pgrep', '-x', 'hyprlock'])
        return True
    except subprocess.CalledProcessError:
        return False

def listen_hyprland_ipc():
    global current_app_class, current_app_title
    hypr_sig = os.environ.get("HYPRLAND_INSTANCE_SIGNATURE")
    if not hypr_sig: return

    sock_path = f"{XDG_RUNTIME}/hypr/{hypr_sig}/.socket2.sock"
    if not os.path.exists(sock_path):
        sock_path = f"/tmp/hypr/{hypr_sig}/.socket2.sock"

    while True:
        try:
            client = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
            client.connect(sock_path)
            buffer = ""
            while True:
                data = client.recv(4096).decode('utf-8')
                if not data: break
                buffer += data
                while '\n' in buffer:
                    line, buffer = buffer.split('\n', 1)
                    if line.startswith('activewindow>>'):
                        cls, clean_title = get_active_window_hyprctl()
                        if is_locked() or cls == "hyprlock":
                            current_app_class, current_app_title = "Locked", "Locked"
                        else:
                            current_app_class, current_app_title = cls, clean_title
        except Exception:
            time.sleep(2) 

def dump_state_to_json(c):
    target_date = date.today()
    
    yesterday = target_date - timedelta(days=1)
    c.execute('SELECT SUM(seconds) FROM focus_log WHERE log_date = ?', (yesterday.isoformat(),))
    yesterday_seconds = c.fetchone()[0] or 0

    # Weekly Average and string formatting
    monday = target_date - timedelta(days=target_date.weekday())
    sunday = monday + timedelta(days=6)
    week_range_str = f"{monday.strftime('%b')} {monday.day} - {sunday.strftime('%b')} {sunday.day}"

    # Calculate average ONLY over days in current week that have non-zero usage
    c.execute('''
        SELECT COUNT(DISTINCT log_date), SUM(seconds) 
        FROM focus_log 
        WHERE log_date >= ? AND log_date <= ? AND seconds > 0
    ''', (monday.isoformat(), sunday.isoformat()))
    row = c.fetchone()
    days_count = row[0] or 0
    total_week = row[1] or 0
    average_seconds = total_week // days_count if days_count > 0 else 0
    
    c.execute('SELECT SUM(seconds) FROM focus_log WHERE log_date = ?', (target_date.isoformat(),))
    total_seconds = c.fetchone()[0] or 0

    c.execute('''
        SELECT app_class, COALESCE(app_title, app_class), SUM(seconds) as secs 
        FROM focus_log 
        WHERE log_date = ? 
        GROUP BY app_class 
        ORDER BY secs DESC
    ''', (target_date.isoformat(),))
    
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
        c.execute('SELECT SUM(seconds) FROM focus_log WHERE log_date = ?', (d.isoformat(),))
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
        c.execute('SELECT SUM(seconds) FROM focus_log WHERE log_date = ?', (d.isoformat(),))
        tot = c.fetchone()[0] or 0
        month_data.append({"date": d.isoformat(), "total": tot, "is_target": d == target_date})

    hourly_data = [0] * 48
    
    try:
        c.execute('SELECT hour, SUM(seconds) FROM focus_hourly WHERE log_date = ? GROUP BY hour', (target_date.isoformat(),))
        for row in c.fetchall():
            hr, secs = row
            if 0 <= hr <= 23:
                hourly_data[hr * 2] += secs
    except sqlite3.OperationalError:
        pass 
        
    try:
        c.execute('SELECT interval_idx, SUM(seconds) FROM focus_intervals WHERE log_date = ? GROUP BY interval_idx', (target_date.isoformat(),))
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
        "current": current_app_title,
        "apps": all_apps,
        "week": week_data,
        "month": month_data,
        "hourly": hourly_data
    }
    
    temp_file = STATE_FILE + ".tmp"
    try:
        with open(temp_file, "w") as f:
            json.dump(result, f)
        os.rename(temp_file, STATE_FILE)
    except Exception:
        pass

def main():
    global current_app_class, current_app_title
    current_app_class, current_app_title = get_active_window_hyprctl()
    
    ipc_thread = threading.Thread(target=listen_hyprland_ipc, daemon=True)
    ipc_thread.start()

    conn = init_db()
    c = conn.cursor()

    while True:
        time.sleep(1)
        
        if current_app_class and current_app_class not in ["Unknown", "Locked", "Quickshell", ""]:
            today = date.today().isoformat()
            now = datetime.now()
            current_hour = now.hour
            current_interval = (now.hour * 60 + now.minute) // 15
            
            c.execute('''
                INSERT INTO focus_log (log_date, app_class, seconds, app_title)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(log_date, app_class) 
                DO UPDATE SET seconds = seconds + 1, app_title = excluded.app_title
            ''', (today, current_app_class, 1, current_app_title))
            
            c.execute('''
                INSERT INTO focus_hourly (log_date, hour, app_class, seconds)
                VALUES (?, ?, ?, 1)
                ON CONFLICT(log_date, hour, app_class)
                DO UPDATE SET seconds = seconds + 1
            ''', (today, current_hour, current_app_class))
            
            c.execute('''
                INSERT INTO focus_intervals (log_date, interval_idx, app_class, seconds)
                VALUES (?, ?, ?, 1)
                ON CONFLICT(log_date, interval_idx, app_class)
                DO UPDATE SET seconds = seconds + 1
            ''', (today, current_interval, current_app_class))
            
            conn.commit()

        dump_state_to_json(c)

if __name__ == "__main__":
    main()
