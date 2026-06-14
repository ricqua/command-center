# Command Center Refactor — Design Spec
**Date:** 2026-06-14
**Status:** Approved

---

## Overview

Refactor the Nightfall Command Center from a single monolithic `index.html` into a clean multi-file architecture. The result is a fullscreen, no-scroll personal dashboard for a 1920×1080 display with live email, real project tracking, and a Claude-powered voice interface backed by ElevenLabs TTS.

---

## Goals

- Lock the page to 100vh/100vw — no scrolling ever
- Split the monolith into focused, single-responsibility files
- Replace all hardcoded/fake data with real data from the backend
- Add Claude AI to the voice interface (context-aware, generative responses)
- Add ElevenLabs TTS with browser TTS fallback
- Improve contrast and readability for 1920×1080
- Scan `C:\Users\ricqua\Desktop\Projects\` for projects automatically

---

## Out of Scope (Next Phase)

- Persistent memory / central brain (Obsidian or equivalent) — separate subsystem
- Editable project list from the UI — projects come from directory scan only
- Any mobile or responsive layout — 1920×1080 landscape only

---

## File Structure

```
command-center/
├── index.html              # Shell only — loads CSS + JS modules
├── style.css               # All styles
├── js/
│   ├── clocks.js           # 3 timezone clocks + date display
│   ├── neural.js           # Canvas neural network animation
│   ├── email.js            # Polls /metrics, renders both inboxes
│   ├── voice.js            # STT → Claude → ElevenLabs/browser TTS
│   └── projects.js         # Polls /projects, renders left panel
├── backend/
│   ├── server.py           # HTTP server — existing + new routes
│   ├── requirements.txt    # + anthropic + requests
│   ├── credentials.json
│   ├── token_gmail.json
│   ├── token_workspace.json
│   └── start.bat
├── config.json             # API keys + paths (gitignored, never committed)
└── docs/
    └── superpowers/
        └── specs/
            └── 2026-06-14-command-center-refactor-design.md
```

`config.json` shape:
```json
{
  "anthropic_api_key": "sk-ant-...",
  "elevenlabs_api_key": "...",
  "elevenlabs_voice_id": "21m00Tcm4TlvDq8ikWAM",
  "projects_dir": "/mnt/c/Users/ricqua/Desktop/Projects",
  "claude_model": "claude-haiku-4-5"
}
```

---

## Layout

Grid locked to 100vh × 100vw, `overflow: hidden`. Optimized for 1920×1080.

```
┌─────────────────────────────────────────────────────┐  60px
│  HEADER: Logo · TX/SA/KR Clocks · Date · Status     │
├──────────────┬──────────────────────┬───────────────┤
│              │                      │               │
│  LEFT 280px  │   CENTER 1fr         │  RIGHT 300px  │
│              │                      │               │
│  Projects    │   Neural Canvas      │  Gmail        │
│  Focus       │   NF Ring + Voice    │  Workspace    │
│  Activity    │                      │  Sys Health   │
│  Log         │                      │  KPIs         │
│              │                      │               │
├──────────────┴──────────────────────┴───────────────┤  56px
│  BOTTOM: 6 metric cells                             │
└─────────────────────────────────────────────────────┘
```

Grid definition:
```css
.grid {
  display: grid;
  grid-template-columns: 280px 1fr 300px;
  grid-template-rows: 60px 1fr 56px;
  height: 100vh;
  overflow: hidden;
}
```

---

## Visual Design

**Color changes for contrast:**
- `--text`: `#c8f0ff` → `#e8f8ff` (brighter body text)
- `--text-dim`: `#4a8ea0` → `#6ab4cc` (more readable secondary text)
- `--panel`: `rgba(0,20,35,0.85)` → `rgba(0,15,28,0.95)` (darker panels, more contrast)
- `--border-bright`: `rgba(0,245,255,0.5)` → `rgba(0,245,255,0.65)` (sharper borders)
- Scanline overlay opacity reduced from `0.06` → `0.03` (less muddy)

**Typography:** All panel font sizes increase ~10% for 1080p readability (e.g. `kpi-value` 20px → 22px, `session-title` 10px → 11px).

**Right panel:** Width increases from 280px → 300px for email list breathing room.

---

## Left Panel — Projects + Focus + Log

### Projects
- `projects.js` calls `GET /projects` on load and every 60s
- Each project renders as a card: name, last-modified date, status dot
  - Green dot = modified within 24h (active)
  - Amber dot = modified within 7 days (recent)
  - Dim dot = older (idle)
- Source: `/mnt/c/Users/ricqua/Desktop/Projects/` subdirectory scan

### Focus Reminder
- Single highlighted card below project list
- Rotates every 5 minutes through projects ordered by last-modified (most recent first)
- Displays: *"FOCUS: [PROJECT NAME]"* with last-active timestamp
- Passive nudge — no interaction required

### Activity Log
- Replaces current fake log feed with real events
- Sources:
  - Backend events via `GET /log` (email poll results, project scans, chat requests)
  - Frontend events (voice command received, STT started, TTS playing)
- Displays last 15 entries, newest first, auto-prepends
- Format: `HH:MM — event description`

---

## Right Panel — Email + System Health + KPIs

Panel height allocation (approximate):
- Gmail: ~40%
- Workspace: ~30%
- System Health: ~20%
- KPIs: ~10%

### Gmail (`royalbramble@gmail.com`)
- Unread (large, amber when ≥8), Today, Sent Today, Attachments 7d
- Inbox pressure bar
- Up to 8 recent threads (increased from 6), unread rows highlighted amber
- Last-updated timestamp
- Data from `GET /metrics` polled every 2 minutes

### Workspace (`richard.quantrill@royalbramble.com`)
- Same layout as Gmail, slightly more compact
- Shows `⚠ START BACKEND` when offline

### System Health
- CPU cores, RAM, JS heap used, JS heap limit, battery %, network type
- Condensed into 2×3 grid
- Battery and heap progress bars retained
- Data from browser APIs (unchanged)

### KPIs
- Active Projects count — real number from `/projects` scan
- AI Uptime
- Removed: "Sessions Today" (was fake), "Integrations" (was static)

---

## Center Panel — Neural Canvas + Voice

### Neural Canvas
- Algorithm unchanged: 55 nodes, mouse repel/attract, particle edges, click burst
- Fills full center column height between header and footer
- `neural.js` is a direct extraction of existing canvas code

### Voice Interface

**Flow:**
```
User clicks mic
  → Web Speech API STT captures transcript
  → POST /chat { message, context }
  → Backend assembles context snapshot
  → Claude API called (claude-haiku-4-5)
  → Response text returned
  → If ElevenLabs key set: POST ElevenLabs API → play audio
  → Else: browser SpeechSynthesis
  → NF ring animates state
```

**NF Ring states:**
- Idle: cyan pulse
- Listening: red fast pulse
- Speaking: green fast pulse

**ElevenLabs config:**
- Model: `eleven_turbo_v2` (lowest latency)
- Voice ID: configurable in `config.json` (default: Rachel — `21m00Tcm4TlvDq8ikWAM`)
- Fallback: browser TTS if key absent or API call fails
- Audio played via `<audio>` element with blob URL from API response

**Browser TTS fallback:**
- Prefers: Google UK English Male → Microsoft David → Daniel → first English voice
- Pitch: 0.85, Rate: 0.92

---

## Backend — New Endpoints

### `GET /projects`
Scans `config["projects_dir"]`. For each subdirectory returns:
```json
[
  {
    "name": "command-center",
    "last_modified": "2026-06-14T21:30:00",
    "age": "active"
  }
]
```
Age categories: `active` (< 24h), `recent` (< 7d), `idle` (≥ 7d).

### `POST /chat`
Request: `{"message": "user transcript"}`

Assembles context snapshot:
- Current time in TX / SA / KR
- Gmail unread + today counts (from cache)
- Workspace unread + today counts (from cache)
- Project list with ages (from last scan)
- Last 5 log entries

Builds Claude system prompt with context, sends user message.
Returns: `{"response": "Claude response text"}`

Claude model: `config["claude_model"]` (default `claude-haiku-4-5`).

### `GET /log`
Returns last 20 log entries:
```json
[
  {"time": "21:30:00", "message": "gmail — ok — 7 unread"},
  {"time": "21:28:00", "message": "projects scan — 1 found"}
]
```

Backend maintains an in-memory log ring buffer (max 100 entries). All existing `print()` calls route through it.

### Updated `requirements.txt`
```
google-auth>=2.0.0
google-auth-oauthlib>=1.0.0
google-auth-httplib2>=0.1.0
google-api-python-client>=2.0.0
anthropic>=0.25.0
requests>=2.31.0
```

---

## Configuration

`config.json` lives at the project root and is gitignored. The backend reads it on startup. Missing keys degrade gracefully:
- No `anthropic_api_key` → `/chat` returns `{"error": "no key"}`, frontend shows error in transcript
- No `elevenlabs_api_key` → frontend silently falls back to browser TTS
- No `projects_dir` → defaults to `/mnt/c/Users/ricqua/Desktop/Projects` (WSL path)

---

## Error Handling

- Backend offline → email panels show `⚠ NO CONNECTION`, voice shows `BACKEND OFFLINE` in transcript
- Claude API error → voice shows `AI UNAVAILABLE`, speaks error via TTS fallback
- ElevenLabs error → silently falls back to browser TTS, no visible error
- Projects dir missing → left panel shows `NO PROJECTS FOUND`
- STT not supported (non-Chrome) → mic button disabled with tooltip

---

## Implementation Order

1. `style.css` — extract + enhance contrast + fix viewport lock
2. `index.html` — rebuild as thin shell
3. `js/clocks.js` — extract, no changes
4. `js/neural.js` — extract, no changes
5. `js/email.js` — extract + increase thread count to 8
6. `js/projects.js` — new: polls /projects, renders cards + focus reminder + log
7. `backend/server.py` — add /projects, /chat, /log routes + log ring buffer + config.json loading
8. `backend/requirements.txt` — add anthropic + requests
9. `js/voice.js` — rewrite: STT → /chat → ElevenLabs/TTS
10. `config.json` — create template (no real keys)
11. `.gitignore` — ensure config.json excluded
