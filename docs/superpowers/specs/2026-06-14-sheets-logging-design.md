# Google Sheets Logging Design

## Goal

Persist hydration events, daily hydration summaries, Claude chat exchanges, and system health samples to a single Google Sheets workbook for time-series analysis and long-term data portability.

## Workbook

**URL:** `https://docs.google.com/spreadsheets/d/13XkPAhM8gVb9BCkFEX1vBOHqKbyI_m3AN1TO3t14pSU/edit`
**Spreadsheet ID:** `13XkPAhM8gVb9BCkFEX1vBOHqKbyI_m3AN1TO3t14pSU`
**Auth account:** `royalbramble@gmail.com` (existing `token_gmail.json`, re-authed with Sheets scope)

## OAuth Scope Change

Current scope: `https://www.googleapis.com/auth/gmail.readonly`

New scopes (both required on the gmail account token):
- `https://www.googleapis.com/auth/gmail.readonly`
- `https://www.googleapis.com/auth/spreadsheets`

On next server start after the scope change, the existing `token_gmail.json` will be deleted and a browser window will open for one-time re-auth. After approval, the new token is cached and no further interaction is needed.

## Architecture

A new `backend/sheets.py` module owns all Sheets I/O. It exposes four public functions called from `server.py`. All writes execute on a background thread via a shared `threading.Thread` + queue pattern so the HTTP server never blocks waiting for the Sheets API. Failed writes retry once after 5 seconds, then are dropped with a warning log entry.

`server.py` changes are minimal:
- Import and initialise `sheets.py` at startup
- Call `sheets.log_hydration()` from the `/hydration` POST handler
- Call `sheets.log_chat()` from the `/chat` POST handler after a successful Claude response
- Start a 5-minute timer loop that calls `sheets.log_syshealth()` using the existing `syshealth_cache`
- Start a midnight timer loop that calls `sheets.upsert_daily_summary()`

A `session_id` (6-char hex, generated once at server start) is passed to `sheets.log_chat()` to group messages from the same server session.

## Sheet Definitions

Headers are written automatically on first run if the sheet tab is empty.

### Sheet 1: `hydration_log`

Written on every successful `+ DRINK` event (via new `/hydration` POST endpoint).

| Column | Type | Example |
|---|---|---|
| `timestamp` | ISO 8601 with UTC offset | `2026-06-14T14:32:07-05:00` |
| `date` | YYYY-MM-DD | `2026-06-14` |
| `count` | integer | `5` |
| `goal` | integer | `14` |

### Sheet 2: `daily_summary`

Upserted (update existing row if date found, append if not) at midnight and on hydration RESET. "Upsert" is implemented by reading column A to find the row with today's date, then updating in place; if not found, appending.

| Column | Type | Example |
|---|---|---|
| `date` | YYYY-MM-DD | `2026-06-14` |
| `total_drinks` | integer | `11` |
| `goal` | integer | `14` |
| `goal_met` | `TRUE` / `FALSE` | `FALSE` |
| `first_drink` | HH:MM (local time) | `09:14` |
| `last_drink` | HH:MM (local time) | `17:45` |

`first_drink` and `last_drink` are derived from the `hydration_log` sheet at upsert time by scanning for rows matching today's date.

### Sheet 3: `chat_log`

Two rows appended per completed Claude exchange — one for the user turn, one for the assistant turn — written after a successful `/chat` response.

| Column | Type | Example |
|---|---|---|
| `timestamp` | ISO 8601 with UTC offset | `2026-06-14T14:32:07-05:00` |
| `date` | YYYY-MM-DD | `2026-06-14` |
| `role` | `user` or `assistant` | `user` |
| `content` | string | `what's on my calendar today` |
| `session_id` | 6-char hex | `a3f2c1` |

### Sheet 4: `system_health_log`

One row appended every 5 minutes by a background timer using the latest `syshealth_cache` values. Network values converted from bytes/sec to KB/sec (divided by 1024, rounded to 1 decimal).

| Column | Type | Example |
|---|---|---|
| `timestamp` | ISO 8601 with UTC offset | `2026-06-14T14:30:00-05:00` |
| `date` | YYYY-MM-DD | `2026-06-14` |
| `cpu_pct` | float (1 decimal) | `34.2` |
| `ram_pct` | float (1 decimal) | `61.8` |
| `disk_pct` | float (1 decimal) | `28.4` |
| `net_sent_kb` | float (1 decimal) | `12.4` |
| `net_recv_kb` | float (1 decimal) | `88.1` |

## New Backend Endpoint: `/hydration`

Currently the hydration `+ DRINK` click is handled entirely in the browser with no backend call. To log to Sheets, the backend needs to know when a drink occurs.

Add a `POST /hydration` endpoint to `server.py` that accepts `{ "count": 5 }` and calls `sheets.log_hydration(count)`. The frontend (`js/hydration.js`) calls this endpoint on each drink click (fire-and-forget fetch — if the backend is offline, the local count still increments normally).

## Error Handling

- All Sheets calls are on a background thread — HTTP responses are never delayed
- If a write fails, retry once after 5 seconds
- If retry fails, call `log()` with a warning and drop the write
- If `token_gmail.json` lacks Sheets scope, the first write attempt will raise an auth error — caught, logged as `"sheets — auth error — re-run server to re-auth"`, and all subsequent writes are skipped for that session

## Files

| File | Action |
|---|---|
| `backend/sheets.py` | Create — all Sheets logic |
| `backend/server.py` | Modify — scope change, import sheets, add `/hydration` POST, call log functions, start timers |
| `js/hydration.js` | Modify — fire-and-forget POST to `/hydration` on drink click |
