# Google Sheets Logging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist hydration events, daily summaries, Claude chat turns, and system health samples to four sheets in an existing Google Sheets workbook.

**Architecture:** A new `backend/sheets.py` module owns all Sheets I/O and exposes four public functions. All writes are fire-and-forget on a background thread via a `queue.Queue`. `server.py` calls into `sheets.py` at the right moments and starts two new background timers (5-min syshealth log, midnight daily summary). `js/hydration.js` gains one fire-and-forget `fetch` POST on each drink click so the backend knows when to log.

**Tech Stack:** Python `google-api-python-client` (already installed), `queue.Queue` for async writes, vanilla JS `fetch` for the new `/hydration` endpoint.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `backend/sheets.py` | Create | All Sheets auth, write queue, four log functions |
| `backend/server.py` | Modify | Add Sheets scope, import sheets, `/hydration` POST, call log functions, start timers |
| `js/hydration.js` | Modify | Fire-and-forget POST to `/hydration` on drink click and reset |

---

## Task 1: Create `backend/sheets.py`

**Files:**
- Create: `backend/sheets.py`

- [ ] **Step 1: Create the file with auth, queue, and helper utilities**

Create `/mnt/c/Users/ricqua/Desktop/Projects/command-center/backend/sheets.py` with this full content:

```python
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


def upsert_daily_summary(total_drinks, goal=14):
    """Update today's row in daily_summary, or append if not present."""
    if not _enabled:
        return
    svc = _get_service()
    if not svc:
        return
    date = _today()
    try:
        _ensure_header(svc, 'daily_summary')
        # Read all dates in column A
        result = svc.spreadsheets().values().get(
            spreadsheetId=SPREADSHEET_ID,
            range='daily_summary!A:A'
        ).execute()
        rows = result.get('values', [])

        # Find first_drink and last_drink from hydration_log
        hl = svc.spreadsheets().values().get(
            spreadsheetId=SPREADSHEET_ID,
            range='hydration_log!A:B'
        ).execute().get('values', [])
        drink_times = [r[0] for r in hl[1:] if len(r) >= 2 and r[1] == date]
        first_drink = drink_times[0][11:16]  if drink_times else ''
        last_drink  = drink_times[-1][11:16] if drink_times else ''

        goal_met = 'TRUE' if total_drinks >= goal else 'FALSE'
        new_row = [date, total_drinks, goal, goal_met, first_drink, last_drink]

        # Find existing row index (1-based, skip header)
        row_index = None
        for i, r in enumerate(rows):
            if r and r[0] == date:
                row_index = i + 1  # 1-based sheet row
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
```

- [ ] **Step 2: Verify the file parses cleanly**

```bash
cd /mnt/c/Users/ricqua/Desktop/Projects/command-center
python3 -c "import backend.sheets; print('sheets.py ok')"
```

Expected: `sheets.py ok` — no ImportError or SyntaxError.

- [ ] **Step 3: Commit**

```bash
git add backend/sheets.py
git commit -m "feat: add sheets.py — async Google Sheets write queue and four log functions"
```

---

## Task 2: Update OAuth scope and wire `sheets.py` into `server.py`

**Files:**
- Modify: `backend/server.py`

This task has four sub-changes: (a) expand SCOPES, (b) import sheets + inject log + generate session_id, (c) call `sheets.log_chat()` in `/chat` handler, (d) add `/hydration` POST handler, (e) start syshealth-log and midnight-summary timers in `__main__`.

- [ ] **Step 1: Expand SCOPES at the top of `server.py`**

Find (around line 18):
```python
SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']
```

Replace with:
```python
SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/spreadsheets',
]
```

- [ ] **Step 2: Import sheets, inject log function, and generate session_id**

After the `CONFIG = load_config()` line (around line 31), add:

```python
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
import sheets as _sheets
import secrets
SESSION_ID = secrets.token_hex(3)  # 6-char hex, stable for this server run
```

Then after the `def log(msg):` function definition (around line 51), add:

```python
_sheets.set_log(log)
```

- [ ] **Step 3: Call `sheets.log_chat()` in the `/chat` POST handler**

Find in `do_POST` (around line 440):
```python
                    self.send_json({'response': text})
```

Replace with:
```python
                    self.send_json({'response': text})
                    threading.Thread(
                        target=_sheets.log_chat,
                        args=(message, text, SESSION_ID),
                        daemon=True
                    ).start()
```

- [ ] **Step 4: Add `/hydration` POST handler**

In `do_POST`, after the `/chat` block and before the `/tts` block, add:

```python
        elif self.path == '/hydration':
            length = int(self.headers.get('Content-Length', 0))
            body   = self.rfile.read(length)
            try:
                data  = json.loads(body)
                count = int(data.get('count', 0))
                goal  = int(data.get('goal', 14))
                threading.Thread(
                    target=_sheets.log_hydration,
                    args=(count, goal),
                    daemon=True
                ).start()
                self.send_json({'ok': True})
            except Exception as e:
                self.send_json({'error': str(e)}, 400)
```

- [ ] **Step 5: Start syshealth-log and midnight-summary timers in `__main__`**

After `threading.Thread(target=syshealth_loop, daemon=True).start()` (around line 527), add:

```python
    def syshealth_sheets_loop():
        while True:
            time.sleep(300)  # 5 minutes
            with syshealth_lock:
                data = dict(syshealth_cache)
            _sheets.log_syshealth(data)

    def midnight_summary_loop():
        while True:
            now = datetime.datetime.now()
            # sleep until next midnight
            tomorrow = (now + datetime.timedelta(days=1)).replace(
                hour=0, minute=0, second=5, microsecond=0)
            time.sleep((tomorrow - now).total_seconds())
            with cache_lock:
                hyd = dict(cache)
            # total_drinks not tracked server-side; daily_summary will
            # derive from hydration_log sheet directly
            _sheets.upsert_daily_summary(total_drinks=0)

    threading.Thread(target=syshealth_sheets_loop, daemon=True).start()
    threading.Thread(target=midnight_summary_loop,  daemon=True).start()
```

> **Note on `midnight_summary_loop`:** The server doesn't track the running drink count — that lives in the browser. Passing `total_drinks=0` at midnight causes `upsert_daily_summary` to count rows from `hydration_log` for today and use that as the total. The function already reads `hydration_log` to find `first_drink` / `last_drink`, so we need to also update it to derive `total_drinks` from that same read. See Task 3 step 1 for the `upsert_daily_summary` fix.

- [ ] **Step 6: Delete `token_gmail.json` to force re-auth with new scope**

```bash
rm /mnt/c/Users/ricqua/Desktop/Projects/command-center/backend/token_gmail.json
```

Expected: file removed. On next server start a browser window will open for re-auth.

- [ ] **Step 7: Start the backend and complete re-auth**

```bash
cd /mnt/c/Users/ricqua/Desktop/Projects/command-center/backend
python3 server.py
```

Expected: browser opens to Google OAuth. Select `royalbramble@gmail.com`, approve Gmail + Sheets scopes. Terminal should then show:
```
sheets — authenticated ok
Serving on http://localhost:5050
```

- [ ] **Step 8: Commit**

```bash
git add backend/server.py
git commit -m "feat: wire sheets.py into server — chat log, hydration endpoint, syshealth + midnight timers"
```

---

## Task 3: Fix `upsert_daily_summary` to derive `total_drinks` from sheet

**Files:**
- Modify: `backend/sheets.py`

The midnight timer passes `total_drinks=0` because the server doesn't track it. The function should derive the count from `hydration_log` rows for today instead.

- [ ] **Step 1: Update `upsert_daily_summary` signature and count logic**

In `backend/sheets.py`, find the `upsert_daily_summary` function. Replace its full body with:

```python
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
```

- [ ] **Step 2: Verify parse**

```bash
python3 -c "import backend.sheets; print('ok')"
```

Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add backend/sheets.py
git commit -m "fix: upsert_daily_summary derives total_drinks from hydration_log when not provided"
```

---

## Task 4: Update `js/hydration.js` to POST on drink and reset

**Files:**
- Modify: `js/hydration.js`

- [ ] **Step 1: Add fire-and-forget POST helper and call it on drink**

In `js/hydration.js`, find the drink button listener (around line 93):

```javascript
  document.getElementById('hyd-drink').addEventListener('click', () => {
    if (count >= GOAL) return;
    count++;
    save(count);
    render(count);
    if (window.logEvent) window.logEvent(`hydration — ${count}/${GOAL} glasses`);
  });
```

Replace with:

```javascript
  function postHydration(count) {
    fetch('http://localhost:5050/hydration', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count, goal: GOAL }),
    }).catch(() => {});
  }

  document.getElementById('hyd-drink').addEventListener('click', () => {
    if (count >= GOAL) return;
    count++;
    save(count);
    render(count);
    postHydration(count);
    if (window.logEvent) window.logEvent(`hydration — ${count}/${GOAL} glasses`);
  });
```

- [ ] **Step 2: Call `postHydration(0)` on confirmed reset**

Find the reset confirmation block (around line 114):
```javascript
      count = 0;
      save(0);
      render(0);
      if (window.logEvent) window.logEvent('hydration — reset');
```

Replace with:
```javascript
      count = 0;
      save(0);
      render(0);
      postHydration(0);
      if (window.logEvent) window.logEvent('hydration — reset');
```

- [ ] **Step 3: Verify the file has no syntax errors**

Open the dashboard in Chrome with the backend running. Open DevTools console. Click `+ DRINK`. Expected: no JS errors, and in the backend terminal you should see a log line like `sheets — ...` or no error (the POST fires silently).

- [ ] **Step 4: Commit**

```bash
git add js/hydration.js
git commit -m "feat: hydration.js — fire-and-forget POST to /hydration on drink and reset"
```

---

## Task 5: End-to-end verification

**No file changes — observation only.**

- [ ] **Step 1: Start backend and confirm Sheets auth**

```bash
cd /mnt/c/Users/ricqua/Desktop/Projects/command-center/backend
python3 server.py
```

Expected terminal output includes:
```
sheets — authenticated ok
Serving on http://localhost:5050
```

- [ ] **Step 2: Verify hydration_log write**

Open `http://localhost:5050` in Chrome. Click `+ DRINK` once. Wait 3 seconds. Open the Google Sheet at `https://docs.google.com/spreadsheets/d/13XkPAhM8gVb9BCkFEX1vBOHqKbyI_m3AN1TO3t14pSU/edit`. Check the `hydration_log` tab.

Expected: one data row with today's date, count=1, goal=14.

- [ ] **Step 3: Verify chat_log write**

Type a message into the chat input and press Enter. Wait 5 seconds. Check the `chat_log` tab in the Sheet.

Expected: two rows — one `user` row with your message, one `assistant` row with Nightfall's response. Both share the same `session_id`.

- [ ] **Step 4: Verify system_health_log write**

Wait 5 minutes (or temporarily change `time.sleep(300)` to `time.sleep(10)` in the `syshealth_sheets_loop`, restart, wait 15 seconds, then revert). Check `system_health_log` tab.

Expected: one row with today's date and CPU/RAM/disk/network values.

- [ ] **Step 5: Verify daily_summary upsert**

In the backend terminal, manually trigger the upsert to test without waiting for midnight:

```bash
python3 -c "
import sys; sys.path.insert(0, '.')
import sheets
sheets.set_log(print)
sheets.upsert_daily_summary()
"
```

Run from `/mnt/c/Users/ricqua/Desktop/Projects/command-center/backend`.

Expected: prints `sheets — daily_summary upserted — 2026-06-14 N/14` and a row appears in the `daily_summary` tab with today's date, drink count derived from `hydration_log`, and first/last drink times.

- [ ] **Step 6: Push to GitHub**

```bash
git push origin master
```

Expected: `master -> master` with the four new commits.

---

## Self-Review

**Spec coverage:**
- ✅ `hydration_log` — Task 1 (`log_hydration`) + Task 4 (JS POST)
- ✅ `daily_summary` — Task 1 (`upsert_daily_summary`) + Task 3 (derive count) + Task 2 (midnight timer)
- ✅ `chat_log` — Task 1 (`log_chat`) + Task 2 (called after `/chat` response)
- ✅ `system_health_log` — Task 1 (`log_syshealth`) + Task 2 (5-min timer)
- ✅ OAuth re-auth — Task 2, steps 1 + 6 + 7
- ✅ Headers auto-written — `_ensure_header()` in Task 1
- ✅ Retry once on failure — `_writer_loop` in Task 1
- ✅ Fire-and-forget (never blocks HTTP) — all writes go via `_write_q` or `threading.Thread`
- ✅ `session_id` per server run — `secrets.token_hex(3)` in Task 2

**Placeholder scan:** None found. All code blocks are complete.

**Type consistency:** `log_hydration(count, goal)`, `log_chat(user_msg, ai_msg, session_id)`, `log_syshealth(data)`, `upsert_daily_summary(total_drinks, goal)` — consistent across Task 1 definition and Task 2 call sites.
