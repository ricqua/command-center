"""
Nightfall — Google Sheets logging
All writes are async (background thread + queue). Fire-and-forget.
"""

import os
import queue
import threading
import time
import datetime

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

SPREADSHEET_ID = '13XkPAhM8gVb9BCkFEX1vBOHqKbyI_m3AN1TO3t14pSU'

SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/spreadsheets',
]

TOKEN_PATH = os.path.join(os.path.dirname(__file__), 'token_gmail.json')
CREDS_PATH = os.path.join(os.path.dirname(__file__), 'credentials.json')

SHEET_HEADERS = {
    'hydration_log':    ['timestamp', 'date', 'count', 'goal'],
    'daily_summary':    ['date', 'total_drinks', 'goal', 'goal_met', 'first_drink', 'last_drink'],
    'chat_log':         ['timestamp', 'date', 'role', 'content', 'session_id'],
    'system_health_log':['timestamp', 'date', 'cpu_pct', 'ram_pct', 'disk_pct', 'net_sent_kb', 'net_recv_kb'],
}

_service   = None
_svc_lock  = threading.Lock()
_write_q   = queue.Queue()
_enabled   = True
_log_fn    = print  # replaced by server.py after import


def set_log(fn):
    global _log_fn
    _log_fn = fn


def _get_service():
    global _service, _enabled
    with _svc_lock:
        if _service:
            return _service
        try:
            creds = None
            if os.path.exists(TOKEN_PATH):
                creds = Credentials.from_authorized_user_file(TOKEN_PATH, SCOPES)
            if not creds or not creds.valid:
                if creds and creds.expired and creds.refresh_token:
                    creds.refresh(Request())
                    with open(TOKEN_PATH, 'w') as f:
                        f.write(creds.to_json())
                else:
                    _log_fn('sheets — token missing Sheets scope — delete token_gmail.json and restart to re-auth')
                    _enabled = False
                    return None
            _service = build('sheets', 'v4', credentials=creds)
            _log_fn('sheets — authenticated ok')
            return _service
        except Exception as e:
            _log_fn(f'sheets — auth error — {e}')
            _enabled = False
            return None


def _ensure_header(svc, sheet_name):
    """Write header row if sheet is empty."""
    try:
        result = svc.spreadsheets().values().get(
            spreadsheetId=SPREADSHEET_ID,
            range=f'{sheet_name}!A1:Z1'
        ).execute()
        if not result.get('values'):
            svc.spreadsheets().values().append(
                spreadsheetId=SPREADSHEET_ID,
                range=f'{sheet_name}!A1',
                valueInputOption='RAW',
                body={'values': [SHEET_HEADERS[sheet_name]]}
            ).execute()
    except Exception as e:
        _log_fn(f'sheets — header check failed ({sheet_name}) — {e}')


def _append(sheet_name, row):
    """Append a single row. Called from background thread only."""
    svc = _get_service()
    if not svc:
        return
    try:
        _ensure_header(svc, sheet_name)
        svc.spreadsheets().values().append(
            spreadsheetId=SPREADSHEET_ID,
            range=f'{sheet_name}!A1',
            valueInputOption='RAW',
            body={'values': [row]}
        ).execute()
    except Exception as e:
        _log_fn(f'sheets — append failed ({sheet_name}) — {e}')
        raise  # let caller retry


def _now_iso():
    now = datetime.datetime.now().astimezone()
    return now.isoformat(timespec='seconds')


def _today():
    return datetime.date.today().isoformat()


def _time_hhmm():
    return datetime.datetime.now().strftime('%H:%M')


# ── Writer thread ─────────────────────────────────────────────────────────────

def _writer_loop():
    while True:
        item = _write_q.get()
        if not _enabled:
            _write_q.task_done()
            continue
        sheet_name, row = item
        try:
            _append(sheet_name, row)
        except Exception:
            # retry once after 5s
            time.sleep(5)
            try:
                _append(sheet_name, row)
            except Exception as e:
                _log_fn(f'sheets — write dropped ({sheet_name}) — {e}')
        _write_q.task_done()


threading.Thread(target=_writer_loop, daemon=True).start()


# ── Public API ────────────────────────────────────────────────────────────────

def log_hydration(count, goal=14):
    if not _enabled:
        return
    _write_q.put(('hydration_log', [_now_iso(), _today(), count, goal]))


def log_chat(user_msg, ai_msg, session_id):
    if not _enabled:
        return
    ts = _now_iso()
    date = _today()
    _write_q.put(('chat_log', [ts, date, 'user',      user_msg, session_id]))
    _write_q.put(('chat_log', [ts, date, 'assistant', ai_msg,   session_id]))


def log_syshealth(data):
    if not _enabled or not data or data.get('status') != 'ok':
        return
    _write_q.put(('system_health_log', [
        _now_iso(),
        _today(),
        round(data.get('cpu',  0), 1),
        round(data.get('ram',  0), 1),
        round(data.get('disk', 0), 1),
        round(data.get('net_sent', 0) / 1024, 1),
        round(data.get('net_recv', 0) / 1024, 1),
    ]))


def upsert_daily_summary(total_drinks=None, goal=14):
    """Update today's row in daily_summary. If total_drinks is None, count from hydration_log."""
    if not _enabled:
        return
    svc = _get_service()
    if not svc:
        return
    date = _today()
    try:
        _ensure_header(svc, 'daily_summary')

        # Read hydration_log to get drink times and count for today
        hl = svc.spreadsheets().values().get(
            spreadsheetId=SPREADSHEET_ID,
            range='hydration_log!A:D'
        ).execute().get('values', [])
        today_rows  = [r for r in hl[1:] if len(r) >= 2 and r[1] == date]
        drink_times = [r[0] for r in today_rows]
        first_drink = drink_times[0][11:16]  if drink_times else ''
        last_drink  = drink_times[-1][11:16] if drink_times else ''
        if total_drinks is None:
            total_drinks = len(today_rows)

        goal_met = 'TRUE' if total_drinks >= goal else 'FALSE'
        new_row  = [date, total_drinks, goal, goal_met, first_drink, last_drink]

        # Find existing row index in daily_summary
        result = svc.spreadsheets().values().get(
            spreadsheetId=SPREADSHEET_ID,
            range='daily_summary!A:A'
        ).execute()
        rows = result.get('values', [])
        row_index = None
        for i, r in enumerate(rows):
            if r and r[0] == date:
                row_index = i + 1
                break

        if row_index:
            svc.spreadsheets().values().update(
                spreadsheetId=SPREADSHEET_ID,
                range=f'daily_summary!A{row_index}',
                valueInputOption='RAW',
                body={'values': [new_row]}
            ).execute()
        else:
            svc.spreadsheets().values().append(
                spreadsheetId=SPREADSHEET_ID,
                range='daily_summary!A1',
                valueInputOption='RAW',
                body={'values': [new_row]}
            ).execute()
        _log_fn(f'sheets — daily_summary upserted — {date} {total_drinks}/{goal}')
    except Exception as e:
        _log_fn(f'sheets — daily_summary upsert failed — {e}')
