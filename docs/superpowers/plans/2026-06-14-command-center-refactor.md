# Command Center Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the monolithic Nightfall Command Center into a fullscreen, no-scroll, multi-file dashboard with live project scanning, Claude-powered voice, and ElevenLabs TTS.

**Architecture:** Single HTML shell loads CSS and JS modules as separate files. A Python backend (Flask-free, stdlib HTTP) serves `/metrics`, `/projects`, `/chat`, and `/log` endpoints. The frontend polls the backend and renders all panels from live data.

**Tech Stack:** Vanilla HTML/CSS/JS (no bundler), Python 3 stdlib + `anthropic` + `requests` + Google API client, Web Speech API (STT), ElevenLabs REST API (TTS), browser SpeechSynthesis (TTS fallback).

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `index.html` | Rewrite | Thin shell — HTML structure + `<script>` / `<link>` tags only |
| `style.css` | Create | All styles extracted from old `index.html`, updated contrast, viewport lock |
| `js/clocks.js` | Create | TX / SA / KR clocks + date display |
| `js/neural.js` | Create | Canvas neural network animation |
| `js/email.js` | Create | Polls `/metrics`, renders Gmail + Workspace panels |
| `js/projects.js` | Create | Polls `/projects`, renders project cards, focus reminder, activity log |
| `js/voice.js` | Create | STT → `/chat` → ElevenLabs or browser TTS |
| `backend/server.py` | Modify | Add `/projects`, `/chat`, `/log`, config loading, log ring buffer |
| `backend/requirements.txt` | Modify | Add `anthropic>=0.25.0` and `requests>=2.31.0` |
| `config.json` | Create | Template with placeholder keys (gitignored) |
| `.gitignore` | Create | Ensures `config.json` + tokens never committed |

---

## Task 1: Bootstrap — `.gitignore` and `config.json` template

**Files:**
- Create: `.gitignore`
- Create: `config.json`

- [ ] **Step 1: Create `.gitignore`**

Create `/mnt/c/Users/ricqua/Desktop/Projects/command-center/.gitignore` with this exact content:

```
config.json
backend/credentials.json
backend/token_gmail.json
backend/token_workspace.json
.superpowers/
__pycache__/
*.pyc
```

- [ ] **Step 2: Create `config.json` template**

Create `/mnt/c/Users/ricqua/Desktop/Projects/command-center/config.json` with this exact content:

```json
{
  "anthropic_api_key": "sk-ant-REPLACE_ME",
  "elevenlabs_api_key": "REPLACE_ME",
  "elevenlabs_voice_id": "21m00Tcm4TlvDq8ikWAM",
  "projects_dir": "/mnt/c/Users/ricqua/Desktop/Projects",
  "claude_model": "claude-haiku-4-5"
}
```

- [ ] **Step 3: Verify gitignore works**

Run:
```bash
cd /mnt/c/Users/ricqua/Desktop/Projects/command-center
git init
git status
```

Expected: `config.json` does NOT appear in untracked files. `index.html`, `backend/`, `docs/` DO appear.

- [ ] **Step 4: Commit**

```bash
git add .gitignore docs/
git commit -m "chore: add gitignore and spec/plan docs"
```

---

## Task 2: `style.css` — Extract, update contrast, lock viewport

**Files:**
- Create: `style.css`

- [ ] **Step 1: Create `style.css`**

Create `/mnt/c/Users/ricqua/Desktop/Projects/command-center/style.css` with the full CSS below. This is extracted from `index.html` with four changes: updated CSS variables, reduced scanline opacity, `height: 100vh` on `.grid`, and right panel width 300px.

```css
* { margin: 0; padding: 0; box-sizing: border-box; }

:root {
  --cyan: #00f5ff;
  --cyan-dim: #00b8cc;
  --cyan-dark: #003d47;
  --blue: #0080ff;
  --blue-glow: #004499;
  --bg: #020b14;
  --bg2: #041220;
  --bg3: #061828;
  --panel: rgba(0,15,28,0.95);
  --border: rgba(0,245,255,0.18);
  --border-bright: rgba(0,245,255,0.65);
  --text: #e8f8ff;
  --text-dim: #6ab4cc;
  --text-muted: #1e4a5c;
  --green: #00ff88;
  --green-dim: #00aa55;
  --amber: #ffaa00;
  --red: #ff3355;
  --font: 'Courier New', 'Consolas', monospace;
}

body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--font);
  height: 100vh;
  overflow: hidden;
  position: relative;
}

body::before {
  content: '';
  position: fixed;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(0,0,0,0.03) 2px,
    rgba(0,0,0,0.03) 4px
  );
  pointer-events: none;
  z-index: 9999;
}

.grid {
  display: grid;
  grid-template-columns: 280px 1fr 300px;
  grid-template-rows: 60px 1fr 56px;
  height: 100vh;
  overflow: hidden;
  gap: 1px;
  background: var(--border);
}

/* ── HEADER ── */
header {
  grid-column: 1 / -1;
  background: var(--panel);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  border-bottom: 1px solid var(--border-bright);
  position: relative;
  overflow: hidden;
}

header::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0; right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--cyan), transparent);
  animation: scan-h 4s linear infinite;
}

@keyframes scan-h {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

.logo {
  font-size: 13px;
  letter-spacing: 6px;
  color: var(--cyan);
  text-transform: uppercase;
}

.logo span { color: var(--text-dim); font-size: 10px; letter-spacing: 3px; }

.clocks {
  display: flex;
  gap: 24px;
  align-items: center;
}

.clock-zone { text-align: center; }

.clock-time {
  font-size: 18px;
  letter-spacing: 3px;
  color: var(--cyan);
  text-shadow: 0 0 16px var(--cyan);
  line-height: 1;
}

.clock-label {
  font-size: 8px;
  letter-spacing: 3px;
  color: var(--text-dim);
  margin-top: 2px;
}

.clock-sep {
  width: 1px;
  height: 32px;
  background: var(--border);
}

.status-bar {
  display: flex;
  gap: 20px;
  align-items: center;
}

.dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--green);
  box-shadow: 0 0 8px var(--green);
  animation: pulse-dot 2s ease-in-out infinite;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.status-text { font-size: 10px; color: var(--green); letter-spacing: 2px; }

/* ── SIDE PANELS ── */
.panel-left, .panel-right {
  background: var(--panel);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow: hidden;
}

.panel-left { border-right: 1px solid var(--border); }
.panel-right { border-left: 1px solid var(--border); }

.panel-label {
  font-size: 9px;
  letter-spacing: 4px;
  color: var(--text-dim);
  text-transform: uppercase;
  border-bottom: 1px solid var(--border);
  padding-bottom: 6px;
  margin-bottom: 2px;
  flex-shrink: 0;
}

/* ── PROJECT CARDS ── */
.session-card {
  border: 1px solid var(--border);
  padding: 9px 11px;
  background: rgba(0,40,60,0.4);
  position: relative;
  flex-shrink: 0;
}

.session-card::before {
  content: '';
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 2px;
  background: var(--cyan);
  box-shadow: 0 0 6px var(--cyan);
}

.session-card.age-recent::before { background: var(--amber); box-shadow: 0 0 6px var(--amber); }
.session-card.age-idle::before { background: var(--text-muted); box-shadow: none; }

.session-title {
  font-size: 11px;
  color: var(--cyan);
  letter-spacing: 1px;
  margin-bottom: 3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.session-meta {
  font-size: 9px;
  color: var(--text-dim);
  letter-spacing: 1px;
}

/* ── FOCUS REMINDER ── */
.focus-card {
  border: 1px solid var(--cyan-dim);
  padding: 9px 11px;
  background: rgba(0,60,80,0.35);
  position: relative;
  flex-shrink: 0;
}

.focus-label {
  font-size: 8px;
  letter-spacing: 3px;
  color: var(--cyan);
  margin-bottom: 3px;
}

.focus-project {
  font-size: 12px;
  color: var(--cyan);
  text-shadow: 0 0 10px var(--cyan);
  letter-spacing: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.focus-meta {
  font-size: 8px;
  color: var(--text-dim);
  margin-top: 3px;
  letter-spacing: 1px;
}

/* ── ACTIVITY LOG ── */
.log-feed {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-height: 0;
}

.log-entry {
  font-size: 9px;
  color: var(--text-dim);
  letter-spacing: 1px;
  padding: 2px 0;
  border-bottom: 1px solid rgba(0,245,255,0.04);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 0;
}

.log-entry .log-time { color: var(--text-muted); margin-right: 4px; }

/* ── KPI CARDS ── */
.kpi-card {
  border: 1px solid var(--border);
  padding: 9px 11px;
  background: rgba(0,30,50,0.5);
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
}

.kpi-card::after {
  content: '';
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--cyan-dim), transparent);
  animation: kpi-scan 3s linear infinite;
  animation-delay: var(--delay, 0s);
}

@keyframes kpi-scan {
  0% { transform: scaleX(0); opacity: 0; }
  50% { transform: scaleX(1); opacity: 1; }
  100% { transform: scaleX(0); opacity: 0; }
}

.kpi-label { font-size: 8px; color: var(--text-dim); letter-spacing: 3px; }
.kpi-value { font-size: 22px; color: var(--cyan); margin: 4px 0 2px; text-shadow: 0 0 12px var(--cyan); }
.kpi-sub { font-size: 9px; color: var(--green); letter-spacing: 1px; }

/* ── CENTER CANVAS ── */
.center-panel {
  background: var(--bg2);
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

#neural-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.center-overlay {
  position: relative;
  z-index: 10;
  text-align: center;
  pointer-events: none;
}

.ai-ring {
  width: 160px;
  height: 160px;
  border: 1px solid var(--cyan-dim);
  border-radius: 50%;
  position: relative;
  margin: 0 auto 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ai-ring::before, .ai-ring::after {
  content: '';
  position: absolute;
  border-radius: 50%;
  border: 1px solid rgba(0,245,255,0.25);
}

.ai-ring::before { inset: -14px; animation: ring-spin 8s linear infinite; border-top-color: var(--cyan); }
.ai-ring::after { inset: -28px; animation: ring-spin 12s linear infinite reverse; border-right-color: var(--blue); }

@keyframes ring-spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }

.ai-core {
  width: 80px; height: 80px;
  border-radius: 50%;
  background: radial-gradient(circle at 40% 35%, rgba(0,245,255,0.25), rgba(0,60,120,0.6), rgba(2,11,20,0.9));
  border: 1px solid var(--cyan-dim);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  letter-spacing: 2px;
  color: var(--cyan);
  box-shadow: 0 0 30px rgba(0,245,255,0.2), inset 0 0 20px rgba(0,245,255,0.05);
  animation: core-pulse 3s ease-in-out infinite;
}

@keyframes core-pulse {
  0%, 100% { box-shadow: 0 0 20px rgba(0,245,255,0.15), inset 0 0 20px rgba(0,245,255,0.05); }
  50% { box-shadow: 0 0 50px rgba(0,245,255,0.35), inset 0 0 30px rgba(0,245,255,0.1); }
}

.ai-core.listening {
  animation: listen-pulse 0.6s ease-in-out infinite !important;
  border-color: var(--red) !important;
  color: var(--red) !important;
}

@keyframes listen-pulse {
  0%, 100% { box-shadow: 0 0 20px rgba(255,51,85,0.3), inset 0 0 20px rgba(255,51,85,0.1); }
  50% { box-shadow: 0 0 60px rgba(255,51,85,0.7), inset 0 0 30px rgba(255,51,85,0.2); }
}

.ai-core.speaking {
  animation: speak-pulse 0.4s ease-in-out infinite !important;
  border-color: var(--green) !important;
  color: var(--green) !important;
}

@keyframes speak-pulse {
  0%, 100% { box-shadow: 0 0 20px rgba(0,255,136,0.3), inset 0 0 20px rgba(0,255,136,0.1); }
  50% { box-shadow: 0 0 70px rgba(0,255,136,0.6), inset 0 0 40px rgba(0,255,136,0.2); }
}

/* ── VOICE UI ── */
.voice-bar {
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  pointer-events: all;
}

.mic-btn {
  width: 42px; height: 42px;
  border-radius: 50%;
  border: 1px solid var(--border-bright);
  background: rgba(0,20,35,0.8);
  color: var(--cyan);
  font-size: 18px;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: border-color 0.2s, background 0.2s;
}

.mic-btn:hover { background: rgba(0,60,90,0.7); border-color: var(--cyan); }
.mic-btn.active { border-color: var(--red); background: rgba(60,0,20,0.6); color: var(--red); }
.mic-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.voice-transcript {
  font-size: 9px;
  letter-spacing: 2px;
  color: var(--text-dim);
  text-align: center;
  max-width: 220px;
  min-height: 14px;
  transition: color 0.3s;
}

.voice-transcript.heard { color: var(--cyan); }
.voice-transcript.error { color: var(--red); }

.voice-response {
  font-size: 10px;
  letter-spacing: 1px;
  color: var(--green);
  text-align: center;
  max-width: 240px;
  min-height: 14px;
  line-height: 1.5;
  font-style: italic;
}

.voice-waveform {
  display: flex;
  gap: 3px;
  align-items: center;
  height: 20px;
}

.wave-bar {
  width: 3px;
  background: var(--cyan-dim);
  border-radius: 1px;
  transition: height 0.1s;
  height: 4px;
}

.wave-bar.active {
  animation: wave-anim 0.5s ease-in-out infinite;
  animation-delay: var(--d, 0s);
}

@keyframes wave-anim {
  0%, 100% { height: 4px; }
  50% { height: var(--h, 16px); }
}

.center-title {
  font-size: 12px;
  letter-spacing: 6px;
  color: var(--cyan);
  text-shadow: 0 0 20px var(--cyan);
  margin-bottom: 6px;
}

.center-sub {
  font-size: 9px;
  letter-spacing: 3px;
  color: var(--text-dim);
}

/* ── BOTTOM BAR ── */
.bottom-bar {
  grid-column: 1 / -1;
  background: var(--panel);
  border-top: 1px solid var(--border);
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 1px;
  background-color: var(--border);
}

.bottom-kpi {
  background: var(--panel);
  padding: 12px 18px;
  position: relative;
}

.bottom-kpi::before {
  content: attr(data-num);
  position: absolute;
  top: 6px; right: 10px;
  font-size: 8px;
  color: var(--text-muted);
  letter-spacing: 2px;
}

.bk-label { font-size: 8px; color: var(--text-dim); letter-spacing: 3px; margin-bottom: 4px; }
.bk-value { font-size: 18px; color: var(--cyan); text-shadow: 0 0 10px var(--cyan); }
.bk-bar {
  margin-top: 6px;
  height: 2px;
  background: var(--border);
  position: relative;
}

.bk-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--blue), var(--cyan));
  box-shadow: 0 0 6px var(--cyan);
  transition: width 1s ease;
}

.bk-trend { font-size: 9px; margin-top: 3px; color: var(--green); }
.bk-trend.down { color: var(--red); }

/* ── FILE / EMAIL ENTRIES ── */
.file-entry {
  font-size: 9px;
  color: var(--text-dim);
  padding: 4px 0;
  border-bottom: 1px solid rgba(0,245,255,0.05);
  display: flex;
  align-items: center;
  gap: 6px;
  letter-spacing: 1px;
}

.file-dot {
  width: 4px; height: 4px;
  border-radius: 50%;
  background: var(--cyan-dim);
  flex-shrink: 0;
}

.file-dot.active { background: var(--green); box-shadow: 0 0 5px var(--green); }
.file-dot.amber  { background: var(--amber); box-shadow: 0 0 5px var(--amber); }

/* ── EMAIL SECTION ── */
.email-section { flex-shrink: 0; }

.email-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 5px;
  margin-bottom: 6px;
}

.email-recent {
  display: flex;
  flex-direction: column;
  gap: 3px;
  max-height: 120px;
  overflow: hidden;
}

/* ── SYSTEM HEALTH ── */
.health-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 5px;
}

/* ── VERTICAL PROGRESS ── */
.v-bar { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.v-bar-track { flex: 1; background: var(--border); position: relative; overflow: hidden; min-height: 40px; }
.v-bar-fill { position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(0deg, var(--cyan), transparent); transition: height 1.5s ease; }
.v-bar-label { font-size: 8px; color: var(--text-muted); letter-spacing: 1px; text-align: center; }

/* ── CORNER DECOR ── */
.corner { position: absolute; width: 12px; height: 12px; border-color: var(--cyan); border-style: solid; }
.corner-tl { top: 0; left: 0; border-width: 1px 0 0 1px; }
.corner-tr { top: 0; right: 0; border-width: 1px 1px 0 0; }
.corner-bl { bottom: 0; left: 0; border-width: 0 0 1px 1px; }
.corner-br { bottom: 0; right: 0; border-width: 0 1px 1px 0; }

/* ── TICKER ── */
.ticker-wrap { overflow: hidden; height: 14px; position: relative; flex-shrink: 0; }
.ticker {
  white-space: nowrap;
  font-size: 8px;
  color: var(--text-muted);
  letter-spacing: 2px;
  animation: ticker-scroll 24s linear infinite;
  display: inline-block;
}

@keyframes ticker-scroll {
  0% { transform: translateX(100%); }
  100% { transform: translateX(-100%); }
}

/* ── AMBIENT ── */
.ambient { position: fixed; pointer-events: none; z-index: 1; }
.ambient-tl { top: 0; left: 0; width: 300px; height: 300px; background: radial-gradient(circle at 0 0, rgba(0,80,160,0.12), transparent 70%); }
.ambient-br { bottom: 0; right: 0; width: 300px; height: 300px; background: radial-gradient(circle at 100% 100%, rgba(0,160,200,0.08), transparent 70%); }

/* ── SCROLLBAR ── */
::-webkit-scrollbar { width: 3px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
```

- [ ] **Step 2: Commit**

```bash
cd /mnt/c/Users/ricqua/Desktop/Projects/command-center
git add style.css
git commit -m "feat: add style.css with updated contrast and viewport lock"
```

---

## Task 3: `index.html` — Rebuild as thin shell

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Replace `index.html` entirely**

Replace the entire contents of `/mnt/c/Users/ricqua/Desktop/Projects/command-center/index.html` with:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>COMMAND CENTER — R.A.</title>
<link rel="stylesheet" href="style.css">
</head>
<body>

<div class="ambient ambient-tl"></div>
<div class="ambient ambient-br"></div>

<div class="grid">

  <!-- ══ HEADER ══ -->
  <header>
    <div class="logo">
      R . A &nbsp; COMMAND CENTER
      <br><span>SYSTEM STATUS: ONLINE</span>
    </div>
    <div class="clocks">
      <div class="clock-zone">
        <div class="clock-time" id="clock-tx">00:00:00</div>
        <div class="clock-label">TEXAS · CST</div>
      </div>
      <div class="clock-sep"></div>
      <div class="clock-zone">
        <div class="clock-time" id="clock-za">00:00:00</div>
        <div class="clock-label">SOUTH AFRICA · SAST</div>
      </div>
      <div class="clock-sep"></div>
      <div class="clock-zone">
        <div class="clock-time" id="clock-kr">00:00:00</div>
        <div class="clock-label">KOREA · KST</div>
      </div>
    </div>
    <div class="status-bar">
      <div class="dot"></div>
      <div class="status-text">ALL SYSTEMS NOMINAL</div>
      <div style="font-size:9px;color:var(--text-dim);letter-spacing:2px;" id="date-display">—</div>
    </div>
  </header>

  <!-- ══ LEFT PANEL ══ -->
  <div class="panel-left">
    <div class="panel-label">// PROJECTS</div>
    <div id="project-list"></div>

    <div class="panel-label">// FOCUS</div>
    <div id="focus-card" class="focus-card">
      <div class="focus-label">CURRENT FOCUS</div>
      <div class="focus-project" id="focus-project">—</div>
      <div class="focus-meta" id="focus-meta">Loading...</div>
    </div>

    <div class="panel-label">// ACTIVITY LOG</div>
    <div class="log-feed" id="log-feed"></div>
  </div>

  <!-- ══ CENTER ══ -->
  <div class="center-panel">
    <canvas id="neural-canvas"></canvas>
    <div class="center-overlay">
      <div class="ai-ring">
        <div class="ai-core" id="ai-core">NF</div>
      </div>
      <div class="center-title">NIGHTFALL</div>
      <div class="center-sub">SUPERINTELLIGENCE INTERFACE v3.0</div>
      <div class="voice-bar">
        <div class="voice-waveform" id="waveform">
          <div class="wave-bar" style="--d:0s;--h:8px"></div>
          <div class="wave-bar" style="--d:0.07s;--h:14px"></div>
          <div class="wave-bar" style="--d:0.14s;--h:18px"></div>
          <div class="wave-bar" style="--d:0.21s;--h:12px"></div>
          <div class="wave-bar" style="--d:0.28s;--h:16px"></div>
          <div class="wave-bar" style="--d:0.35s;--h:10px"></div>
          <div class="wave-bar" style="--d:0.42s;--h:14px"></div>
        </div>
        <button class="mic-btn" id="mic-btn" title="Click to speak to Nightfall">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
            <rect x="9" y="2" width="6" height="12" rx="3"/>
            <path d="M5 10a7 7 0 0 0 14 0"/><line x1="12" y1="19" x2="12" y2="22"/>
            <line x1="8" y1="22" x2="16" y2="22"/>
          </svg>
        </button>
        <div class="voice-transcript" id="voice-transcript">AWAITING VOICE INPUT</div>
        <div class="voice-response" id="voice-response"></div>
      </div>
    </div>
  </div>

  <!-- ══ RIGHT PANEL ══ -->
  <div class="panel-right">
    <!-- Gmail -->
    <div class="panel-label">// GMAIL · royalbramble@gmail.com</div>
    <div class="email-section kpi-card" style="--delay:0s; padding:8px 11px;">
      <div class="corner corner-tl"></div><div class="corner corner-br"></div>
      <div class="email-grid">
        <div><div class="kpi-label">UNREAD</div><div id="gm-unread" class="kpi-value" style="font-size:22px;">—</div></div>
        <div><div class="kpi-label">TODAY</div><div id="gm-today" class="kpi-value" style="font-size:22px;">—</div></div>
        <div><div class="kpi-label">SENT TODAY</div><div id="gm-sent" class="kpi-value" style="font-size:14px;">—</div></div>
        <div><div class="kpi-label">ATTACH 7D</div><div id="gm-attach" class="kpi-value" style="font-size:14px;">—</div></div>
      </div>
      <div class="kpi-label" style="margin-bottom:3px;">INBOX PRESSURE</div>
      <div class="bk-bar"><div id="gm-pressure" class="bk-bar-fill" style="width:0%"></div></div>
      <div id="gm-updated" style="font-size:7px;color:var(--text-muted);letter-spacing:2px;margin-top:4px;">⚠ START BACKEND</div>
    </div>
    <div class="panel-label">// RECENT · GMAIL</div>
    <div id="gm-recent" class="email-recent"></div>

    <!-- Workspace -->
    <div class="panel-label">// WORKSPACE · richard.quantrill@royalbramble.com</div>
    <div class="email-section kpi-card" style="--delay:0.5s; padding:8px 11px;">
      <div class="corner corner-tl"></div><div class="corner corner-br"></div>
      <div class="email-grid">
        <div><div class="kpi-label">UNREAD</div><div id="ws-unread" class="kpi-value" style="font-size:22px;color:var(--text-muted);">—</div></div>
        <div><div class="kpi-label">TODAY</div><div id="ws-today" class="kpi-value" style="font-size:22px;color:var(--text-muted);">—</div></div>
        <div><div class="kpi-label">SENT TODAY</div><div id="ws-sent" class="kpi-value" style="font-size:14px;color:var(--text-muted);">—</div></div>
        <div><div class="kpi-label">ATTACH 7D</div><div id="ws-attach" class="kpi-value" style="font-size:14px;color:var(--text-muted);">—</div></div>
      </div>
      <div class="kpi-label" style="margin-bottom:3px;">INBOX PRESSURE</div>
      <div class="bk-bar"><div id="ws-pressure" class="bk-bar-fill" style="width:0%"></div></div>
      <div id="ws-updated" style="font-size:7px;color:var(--text-muted);letter-spacing:2px;margin-top:4px;">⚠ START BACKEND</div>
    </div>
    <div class="panel-label">// RECENT · WORKSPACE</div>
    <div id="ws-recent" class="email-recent"></div>

    <!-- System Health -->
    <div class="panel-label">// SYSTEM HEALTH</div>
    <div class="kpi-card" style="--delay:1s; padding:8px 11px;">
      <div class="corner corner-tl"></div><div class="corner corner-br"></div>
      <div class="health-grid">
        <div><div class="kpi-label">CPU CORES</div><div id="sh-cores" class="kpi-value" style="font-size:14px;">—</div></div>
        <div><div class="kpi-label">DEVICE RAM</div><div id="sh-ram" class="kpi-value" style="font-size:14px;">—</div></div>
        <div><div class="kpi-label">JS HEAP</div><div id="sh-heap" class="kpi-value" style="font-size:14px;">—</div></div>
        <div><div class="kpi-label">BATTERY</div><div id="sh-battery" class="kpi-value" style="font-size:14px;">—</div></div>
        <div><div class="kpi-label">NETWORK</div><div id="sh-network" class="kpi-value" style="font-size:14px;" style="grid-column:1/-1;">—</div></div>
      </div>
      <div style="margin-top:6px;">
        <div class="kpi-label" style="margin-bottom:3px;">HEAP USAGE</div>
        <div class="bk-bar"><div id="sh-heap-bar" class="bk-bar-fill" style="width:0%"></div></div>
      </div>
      <div style="margin-top:4px;">
        <div class="kpi-label" style="margin-bottom:3px;">BATTERY</div>
        <div class="bk-bar"><div id="sh-battery-bar" class="bk-bar-fill" style="width:0%;background:linear-gradient(90deg,var(--green-dim),var(--green))"></div></div>
      </div>
    </div>

    <!-- KPIs -->
    <div class="panel-label">// KPIs</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
      <div class="kpi-card" style="--delay:1.5s; padding:8px 11px;">
        <div class="kpi-label">ACTIVE PROJECTS</div>
        <div id="kpi-projects" class="kpi-value">—</div>
        <div class="kpi-sub" id="kpi-projects-sub">SCANNING...</div>
      </div>
      <div class="kpi-card" style="--delay:2s; padding:8px 11px;">
        <div class="kpi-label">AI UPTIME</div>
        <div class="kpi-value">99.9%</div>
        <div class="kpi-sub">OPTIMAL</div>
      </div>
    </div>
  </div>

  <!-- ══ BOTTOM BAR ══ -->
  <div class="bottom-bar">
    <div class="bottom-kpi" data-num="01">
      <div class="bk-label">PROJECTS FOUND</div>
      <div class="bk-value" id="bb-projects">—</div>
      <div class="bk-bar"><div class="bk-bar-fill" id="bb-projects-bar" style="width:0%"></div></div>
      <div class="bk-trend" id="bb-projects-trend">SCANNING</div>
    </div>
    <div class="bottom-kpi" data-num="02">
      <div class="bk-label">NEURAL NODES</div>
      <div class="bk-value" id="node-count">—</div>
      <div class="bk-bar"><div class="bk-bar-fill" id="node-bar" style="width:0%"></div></div>
      <div class="bk-trend">↑ LIVE</div>
    </div>
    <div class="bottom-kpi" data-num="03">
      <div class="bk-label">RESPONSE LATENCY</div>
      <div class="bk-value" id="latency">—</div>
      <div class="bk-bar"><div class="bk-bar-fill" id="latency-bar" style="width:0%"></div></div>
      <div class="bk-trend" id="latency-trend">MEASURING</div>
    </div>
    <div class="bottom-kpi" data-num="04">
      <div class="bk-label">GMAIL UNREAD</div>
      <div class="bk-value" id="bb-email-unread" style="color:var(--amber);text-shadow:0 0 10px var(--amber);">—</div>
      <div class="bk-bar"><div id="bb-email-bar" class="bk-bar-fill" style="width:0%"></div></div>
      <div class="bk-trend" id="bb-email-sub">—</div>
    </div>
    <div class="bottom-kpi" data-num="05">
      <div class="bk-label">SYSTEM INTEGRITY</div>
      <div class="bk-value">NOMINAL</div>
      <div class="bk-bar"><div class="bk-bar-fill" style="width:98%;background:linear-gradient(90deg,var(--green-dim),var(--green))"></div></div>
      <div class="bk-trend">✓ ALL CLEAR</div>
    </div>
    <div class="bottom-kpi" data-num="06">
      <div class="bk-label">VOICE ENGINE</div>
      <div class="bk-value" id="bb-voice-status">READY</div>
      <div class="bk-bar"><div class="bk-bar-fill" id="bb-voice-bar" style="width:100%;background:linear-gradient(90deg,var(--blue),var(--cyan))"></div></div>
      <div class="bk-trend" id="bb-voice-mode">BROWSER TTS</div>
    </div>
  </div>

</div>

<script src="js/clocks.js"></script>
<script src="js/neural.js"></script>
<script src="js/email.js"></script>
<script src="js/projects.js"></script>
<script src="js/voice.js"></script>
</body>
</html>
```

- [ ] **Step 2: Open `index.html` in browser and verify**

Open the file directly in Chrome. Expected: page loads with no errors in DevTools console, grid renders (panels will be empty, clocks will show 00:00:00 since JS not loaded yet). No scrollbars visible.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: rebuild index.html as thin shell"
```

---

## Task 4: `js/clocks.js` — Extract clock logic

**Files:**
- Create: `js/clocks.js`

- [ ] **Step 1: Create `js/clocks.js`**

Create `/mnt/c/Users/ricqua/Desktop/Projects/command-center/js/clocks.js`:

```javascript
(function() {
  const tzFmt = tz => new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false, timeZone: tz
  });

  function updateClocks() {
    const now = new Date();
    document.getElementById('clock-tx').textContent = tzFmt('America/Chicago').format(now);
    document.getElementById('clock-za').textContent = tzFmt('Africa/Johannesburg').format(now);
    document.getElementById('clock-kr').textContent = tzFmt('Asia/Seoul').format(now);
    document.getElementById('date-display').textContent =
      now.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }).toUpperCase();
  }

  updateClocks();
  setInterval(updateClocks, 1000);
})();
```

- [ ] **Step 2: Verify in browser**

Open `index.html` in Chrome. Expected: all three clocks show live times for Texas, South Africa, and Korea. Date appears in header. No console errors.

- [ ] **Step 3: Commit**

```bash
mkdir -p /mnt/c/Users/ricqua/Desktop/Projects/command-center/js
git add js/clocks.js
git commit -m "feat: add clocks.js"
```

---

## Task 5: `js/neural.js` — Extract neural canvas

**Files:**
- Create: `js/neural.js`

- [ ] **Step 1: Create `js/neural.js`**

Create `/mnt/c/Users/ricqua/Desktop/Projects/command-center/js/neural.js`:

```javascript
(function() {
  const canvas = document.getElementById('neural-canvas');
  const ctx = canvas.getContext('2d');

  let W, H, nodes = [], edges = [], particles = [];
  const NODE_COUNT = 55;
  const EDGE_DIST = 130;

  let mouse = { x: -9999, y: -9999, active: false };
  const REPEL_RADIUS = 140;
  const REPEL_FORCE  = 0.55;
  const ATTRACT_RADIUS = 260;
  const ATTRACT_FORCE  = 0.018;

  canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
    mouse.active = true;
  });
  canvas.addEventListener('mouseleave', () => { mouse.active = false; mouse.x = -9999; mouse.y = -9999; });

  canvas.addEventListener('click', e => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    nodes.forEach(n => {
      const dx = n.x - mx, dy = n.y - my;
      const d = Math.sqrt(dx*dx + dy*dy);
      if (d < 200 && d > 0) {
        const f = (1 - d / 200) * 4;
        n.vx += (dx / d) * f;
        n.vy += (dy / d) * f;
      }
    });
    for (let i = 0; i < 8; i++) spawnParticle();
  });

  function resize() {
    W = canvas.width = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
    initNodes();
  }

  function initNodes() {
    nodes = [];
    const cx = W / 2, cy = H / 2;
    for (let i = 0; i < NODE_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() < 0.35
        ? Math.random() * 80
        : 80 + Math.random() * Math.min(W, H) * 0.35;
      nodes.push({
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        r: 1.5 + Math.random() * 2.5,
        brightness: 0.4 + Math.random() * 0.6,
        pulse: Math.random() * Math.PI * 2,
        pulseSpeed: 0.02 + Math.random() * 0.03,
      });
    }
    buildEdges();
  }

  function buildEdges() {
    edges = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const d = Math.sqrt(dx*dx + dy*dy);
        if (d < EDGE_DIST) edges.push({ a: i, b: j, d });
      }
    }
    const nodeCountEl = document.getElementById('node-count');
    const nodeBarEl = document.getElementById('node-bar');
    if (nodeCountEl) nodeCountEl.textContent = nodes.length;
    if (nodeBarEl) nodeBarEl.style.width = Math.min(nodes.length / NODE_COUNT * 100, 100) + '%';
  }

  function spawnParticle() {
    if (edges.length === 0) return;
    const e = edges[Math.floor(Math.random() * edges.length)];
    const forward = Math.random() > 0.5;
    particles.push({
      edgeIdx: edges.indexOf(e),
      t: forward ? 0 : 1,
      speed: (forward ? 1 : -1) * (0.003 + Math.random() * 0.005),
      color: Math.random() > 0.7 ? '#0080ff' : '#00f5ff',
    });
  }

  let lastParticle = 0;
  function animate(ts) {
    ctx.clearRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2;

    nodes.forEach(n => {
      n.x += n.vx; n.y += n.vy;
      const dcx = n.x - cx, dcy = n.y - cy;
      const dcDist = Math.sqrt(dcx*dcx + dcy*dcy);
      if (dcDist > Math.min(W, H) * 0.45) {
        n.vx -= dcx * 0.0002;
        n.vy -= dcy * 0.0002;
      }
      const dmx = n.x - mouse.x, dmy = n.y - mouse.y;
      const dm = Math.sqrt(dmx*dmx + dmy*dmy);
      if (dm < REPEL_RADIUS && dm > 0) {
        const f = (1 - dm / REPEL_RADIUS) * REPEL_FORCE;
        n.vx += (dmx / dm) * f;
        n.vy += (dmy / dm) * f;
      } else if (dm < ATTRACT_RADIUS && dm > REPEL_RADIUS) {
        const f = (1 - (dm - REPEL_RADIUS) / (ATTRACT_RADIUS - REPEL_RADIUS)) * ATTRACT_FORCE;
        n.vx -= (dmx / dm) * f;
        n.vy -= (dmy / dm) * f;
      }
      n.vx *= 0.97; n.vy *= 0.97;
      if (n.x < 10 || n.x > W - 10) n.vx *= -0.8;
      if (n.y < 10 || n.y > H - 10) n.vy *= -0.8;
      n.x = Math.max(10, Math.min(W - 10, n.x));
      n.y = Math.max(10, Math.min(H - 10, n.y));
      n.pulse += n.pulseSpeed;
    });

    if (Math.random() < 0.005) buildEdges();

    if (mouse.active) {
      const ripple = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, REPEL_RADIUS);
      ripple.addColorStop(0, 'rgba(0,245,255,0.06)');
      ripple.addColorStop(0.5, 'rgba(0,128,255,0.03)');
      ripple.addColorStop(1, 'transparent');
      ctx.fillStyle = ripple;
      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, REPEL_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,245,255,0.6)';
      ctx.fill();

      nodes.forEach(n => {
        const dx = n.x - mouse.x, dy = n.y - mouse.y;
        const d = Math.sqrt(dx*dx + dy*dy);
        if (d < REPEL_RADIUS * 1.2) {
          const alpha = (1 - d / (REPEL_RADIUS * 1.2)) * 0.35;
          ctx.beginPath();
          ctx.moveTo(n.x, n.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.strokeStyle = `rgba(0,245,255,${alpha})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      });
    }

    edges.forEach(e => {
      const a = nodes[e.a], b = nodes[e.b];
      const alpha = (1 - e.d / EDGE_DIST) * 0.18;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = `rgba(0,180,220,${alpha})`;
      ctx.lineWidth = 0.5;
      ctx.stroke();
    });

    nodes.forEach(n => {
      const dmx = n.x - mouse.x, dmy = n.y - mouse.y;
      const dm = Math.sqrt(dmx*dmx + dmy*dmy);
      const nearMouse = mouse.active && dm < REPEL_RADIUS;
      const glow = 0.5 + 0.5 * Math.sin(n.pulse);
      const alpha = n.brightness * (nearMouse ? 1 : (0.5 + glow * 0.5));
      const nodeColor = nearMouse ? '255,180,0' : '0,245,255';
      ctx.beginPath();
      ctx.arc(n.x, n.y, nearMouse ? n.r * 1.6 : n.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${nodeColor},${alpha})`;
      ctx.fill();
      if (n.r > 3 || nearMouse) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, (nearMouse ? n.r * 1.6 : n.r) * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${nodeColor},${alpha * 0.1})`;
        ctx.fill();
      }
    });

    const spawnRate = mouse.active ? 60 : 120;
    if (ts - lastParticle > spawnRate && particles.length < 60) {
      spawnParticle();
      lastParticle = ts;
    }

    particles = particles.filter(p => {
      const e = edges[p.edgeIdx];
      if (!e) return false;
      p.t += p.speed;
      if (p.t < 0 || p.t > 1) return false;
      const a = nodes[e.a], b = nodes[e.b];
      const x = a.x + (b.x - a.x) * p.t;
      const y = a.y + (b.y - a.y) * p.t;
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = p.color === '#00f5ff' ? 'rgba(0,245,255,0.2)' : 'rgba(0,128,255,0.2)';
      ctx.fill();
      return true;
    });

    const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, 90);
    grd.addColorStop(0, 'rgba(0,245,255,0.04)');
    grd.addColorStop(1, 'transparent');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);

    requestAnimationFrame(animate);
  }

  resize();
  window.addEventListener('resize', resize);
  requestAnimationFrame(animate);
})();
```

- [ ] **Step 2: Verify in browser**

Open `index.html`. Expected: animated neural network fills the center panel. Mouse hovering causes repel effect. Click causes burst. No console errors.

- [ ] **Step 3: Commit**

```bash
git add js/neural.js
git commit -m "feat: add neural.js"
```

---

## Task 6: `js/email.js` — Extract + increase thread count

**Files:**
- Create: `js/email.js`

- [ ] **Step 1: Create `js/email.js`**

Create `/mnt/c/Users/ricqua/Desktop/Projects/command-center/js/email.js`:

```javascript
(function() {
  const BACKEND = 'http://localhost:5050';

  function fmtSender(s) {
    return (s || '').replace(/"([^"]+)".*/, '$1').trim().toUpperCase().slice(0, 24);
  }

  function fmtSubject(s) {
    return (s || '(no subject)').slice(0, 34);
  }

  function pressureWidth(unread) {
    return Math.min(Math.round((unread / 30) * 100), 100);
  }

  function pressureColor(unread) {
    if (unread >= 20) return 'linear-gradient(90deg,#880022,var(--red))';
    if (unread >= 8)  return 'linear-gradient(90deg,#aa6600,var(--amber))';
    return 'linear-gradient(90deg,var(--blue),var(--cyan))';
  }

  function setEl(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function setStyle(id, prop, val) {
    const el = document.getElementById(id);
    if (el) el.style[prop] = val;
  }

  function renderEmailPanel(key, data) {
    const prefix = key === 'gmail' ? 'gm' : 'ws';

    if (!data || data.status === 'error') {
      setEl(`${prefix}-unread`, '—');
      setEl(`${prefix}-today`, '—');
      setEl(`${prefix}-sent`, '—');
      setEl(`${prefix}-attach`, '—');
      setEl(`${prefix}-updated`, data ? '✗ ERROR' : '⚠ NO CONNECTION');
      return;
    }

    setEl(`${prefix}-unread`, data.unread ?? '—');
    setEl(`${prefix}-today`,  data.today ?? '—');
    setEl(`${prefix}-sent`,   data.sent_today ?? '—');
    setEl(`${prefix}-attach`, data.attachments_7d ?? '—');
    setEl(`${prefix}-updated`, `UPDATED ${data.last_updated}`);

    const w = pressureWidth(data.unread || 0);
    const c = pressureColor(data.unread || 0);
    setStyle(`${prefix}-pressure`, 'width', w + '%');
    setStyle(`${prefix}-pressure`, 'background', c);

    const unreadEl = document.getElementById(`${prefix}-unread`);
    if (unreadEl) {
      unreadEl.style.color = (data.unread >= 8) ? 'var(--amber)' : 'var(--cyan)';
      unreadEl.style.textShadow = (data.unread >= 8) ? '0 0 12px var(--amber)' : '0 0 12px var(--cyan)';
    }

    const feed = document.getElementById(`${prefix}-recent`);
    if (feed && data.recent) {
      feed.innerHTML = '';
      data.recent.slice(0, 8).forEach(m => {
        const row = document.createElement('div');
        row.className = 'file-entry';
        row.style.cssText = 'flex-direction:column;align-items:flex-start;gap:1px;padding:3px 0;';
        const senderColor = m.unread ? 'var(--amber)' : 'var(--cyan-dim)';
        row.innerHTML = `
          <span style="color:${senderColor};font-size:8px;letter-spacing:1px;">${fmtSender(m.sender)}</span>
          <span style="font-size:9px;color:var(--text);">${fmtSubject(m.subject)}</span>`;
        feed.appendChild(row);
      });
    }

    if (key === 'gmail') {
      setEl('bb-email-unread', data.unread ?? '—');
      setEl('bb-email-sub', `${data.today ?? 0} TODAY · ${data.sent_today ?? 0} SENT`);
      const bbBar = document.getElementById('bb-email-bar');
      if (bbBar) {
        bbBar.style.width = pressureWidth(data.unread || 0) + '%';
        bbBar.style.background = pressureColor(data.unread || 0);
      }
    }
  }

  async function fetchEmailMetrics() {
    try {
      const res  = await fetch(`${BACKEND}/metrics`, { signal: AbortSignal.timeout(5000) });
      const data = await res.json();
      renderEmailPanel('gmail',     data.gmail);
      renderEmailPanel('workspace', data.workspace);
      if (window.logEvent) window.logEvent(`email poll — gmail ${data.gmail?.unread ?? '?'} unread`);
    } catch {
      renderEmailPanel('gmail',     null);
      renderEmailPanel('workspace', null);
    }
  }

  fetchEmailMetrics();
  setInterval(fetchEmailMetrics, 120000);
})();
```

- [ ] **Step 2: Verify in browser (backend must be running)**

Start the backend: `cd /mnt/c/Users/ricqua/Desktop/Projects/command-center/backend && python3 server.py`

Open `index.html`. Expected: Gmail panel populates with real unread count, today count, and up to 8 recent threads. If backend not running, panels show `⚠ NO CONNECTION`.

- [ ] **Step 3: Commit**

```bash
git add js/email.js
git commit -m "feat: add email.js with 8-thread limit"
```

---

## Task 7: `backend/server.py` — Add `/projects`, `/chat`, `/log`, config loading

**Files:**
- Modify: `backend/server.py`

- [ ] **Step 1: Replace `backend/server.py` entirely**

Replace the full contents of `/mnt/c/Users/ricqua/Desktop/Projects/command-center/backend/server.py` with:

```python
"""
Nightfall Command Center Backend
Serves: /metrics (Gmail), /projects (dir scan), /chat (Claude), /log, /health
"""

import os
import json
import time
import threading
import datetime
from collections import deque
from http.server import HTTPServer, BaseHTTPRequestHandler
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']
PORT   = 5050

# ── CONFIG ──────────────────────────────────────────────────────────────────

def load_config():
    config_path = os.path.join(os.path.dirname(__file__), '..', 'config.json')
    config_path = os.path.abspath(config_path)
    if os.path.exists(config_path):
        with open(config_path) as f:
            return json.load(f)
    return {}

CONFIG = load_config()

ACCOUNTS = [
    {'key': 'gmail',     'email': 'royalbramble@gmail.com',              'token': 'token_gmail.json'},
    {'key': 'workspace', 'email': 'richard.quantrill@royalbramble.com',  'token': 'token_workspace.json'},
]

PROJECTS_DIR = CONFIG.get('projects_dir', '/mnt/c/Users/ricqua/Desktop/Projects')
ANTHROPIC_KEY = CONFIG.get('anthropic_api_key', '')
CLAUDE_MODEL  = CONFIG.get('claude_model', 'claude-haiku-4-5')

# ── LOG RING BUFFER ─────────────────────────────────────────────────────────

log_buffer = deque(maxlen=100)
log_lock   = threading.Lock()

def log(msg):
    entry = {'time': time.strftime('%H:%M:%S'), 'message': msg}
    with log_lock:
        log_buffer.appendleft(entry)
    print(f"[{entry['time']}] {msg}")

# ── EMAIL CACHE ──────────────────────────────────────────────────────────────

cache      = {}
cache_lock = threading.Lock()

# ── PROJECTS CACHE ───────────────────────────────────────────────────────────

projects_cache = []
projects_lock  = threading.Lock()

# ── AUTH ─────────────────────────────────────────────────────────────────────

def get_service(account):
    creds = None
    token_path = os.path.join(os.path.dirname(__file__), account['token'])
    creds_path = os.path.join(os.path.dirname(__file__), 'credentials.json')
    if os.path.exists(token_path):
        creds = Credentials.from_authorized_user_file(token_path, SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            log(f"Opening browser to authenticate: {account['email']}")
            flow = InstalledAppFlow.from_client_secrets_file(creds_path, SCOPES)
            creds = flow.run_local_server(port=0, prompt='select_account')
        with open(token_path, 'w') as f:
            f.write(creds.to_json())
    return build('gmail', 'v1', credentials=creds)

# ── EMAIL FETCH ──────────────────────────────────────────────────────────────

def fetch_count(service, query):
    try:
        result = service.users().messages().list(userId='me', q=query, maxResults=1).execute()
        return result.get('resultSizeEstimate', 0)
    except Exception:
        return 0

def fetch_recent(service, n=8):
    threads = []
    try:
        result = service.users().threads().list(userId='me', q='in:inbox', maxResults=n).execute()
        for t in result.get('threads', []):
            detail = service.users().threads().get(
                userId='me', id=t['id'], format='metadata',
                metadataHeaders=['Subject', 'From', 'Date']
            ).execute()
            msg  = detail['messages'][0]
            hdrs = {h['name']: h['value'] for h in msg['payload'].get('headers', [])}
            sender = hdrs.get('From', '')
            if '<' in sender:
                sender = sender[:sender.index('<')].strip().strip('"')
            threads.append({
                'subject': hdrs.get('Subject', '(no subject)'),
                'sender':  sender or hdrs.get('From', ''),
                'date':    hdrs.get('Date', ''),
                'unread':  'UNREAD' in msg.get('labelIds', []),
            })
    except Exception:
        pass
    return threads

def poll_account(account):
    try:
        service     = get_service(account)
        unread      = fetch_count(service, 'is:unread in:inbox')
        today       = fetch_count(service, 'in:inbox newer_than:1d')
        sent_today  = fetch_count(service, 'in:sent newer_than:1d')
        attachments = fetch_count(service, 'has:attachment newer_than:7d')
        recent      = fetch_recent(service)
        log(f"{account['email']} — ok — {unread} unread")
        return {
            'email': account['email'], 'unread': unread, 'today': today,
            'sent_today': sent_today, 'attachments_7d': attachments,
            'recent': recent, 'status': 'ok', 'last_updated': time.strftime('%H:%M:%S'),
        }
    except Exception as e:
        log(f"{account['email']} — error — {e}")
        return {
            'email': account['email'], 'unread': None, 'today': None,
            'sent_today': None, 'attachments_7d': None, 'recent': [],
            'status': 'error', 'error': str(e), 'last_updated': time.strftime('%H:%M:%S'),
        }

def poll_loop():
    while True:
        for account in ACCOUNTS:
            result = poll_account(account)
            with cache_lock:
                cache[account['key']] = result
        time.sleep(120)

# ── PROJECTS SCAN ────────────────────────────────────────────────────────────

def age_category(mtime):
    age_seconds = time.time() - mtime
    if age_seconds < 86400:    return 'active'
    if age_seconds < 604800:   return 'recent'
    return 'idle'

def scan_projects():
    results = []
    if not os.path.isdir(PROJECTS_DIR):
        log(f"projects dir not found: {PROJECTS_DIR}")
        return results
    try:
        for entry in sorted(os.scandir(PROJECTS_DIR), key=lambda e: -e.stat().st_mtime):
            if entry.is_dir():
                mtime = entry.stat().st_mtime
                results.append({
                    'name': entry.name,
                    'last_modified': datetime.datetime.fromtimestamp(mtime).strftime('%Y-%m-%dT%H:%M:%S'),
                    'age': age_category(mtime),
                })
        log(f"projects scan — {len(results)} found")
    except Exception as e:
        log(f"projects scan error: {e}")
    return results

def projects_loop():
    while True:
        result = scan_projects()
        with projects_lock:
            projects_cache.clear()
            projects_cache.extend(result)
        time.sleep(60)

# ── CLAUDE CHAT ──────────────────────────────────────────────────────────────

def build_system_prompt():
    now = datetime.datetime.utcnow()
    def fmt_tz(tz_offset_hours):
        t = now + datetime.timedelta(hours=tz_offset_hours)
        return t.strftime('%H:%M')

    tx_time = fmt_tz(-5)   # CST (UTC-5, adjust for DST manually if needed)
    za_time = fmt_tz(2)    # SAST (UTC+2)
    kr_time = fmt_tz(9)    # KST (UTC+9)

    with cache_lock:
        gm = cache.get('gmail', {})
        ws = cache.get('workspace', {})
    with projects_lock:
        projs = list(projects_cache)
    with log_lock:
        recent_logs = list(log_buffer)[:5]

    proj_summary = ', '.join(f"{p['name']} ({p['age']})" for p in projs) or 'none found'
    log_summary  = ' | '.join(e['message'] for e in recent_logs) or 'no recent events'

    return f"""You are Nightfall, the personal AI assistant embedded in R.A.'s Command Center dashboard.
You have real-time awareness of the system state. Be concise — responses will be spoken aloud.
Aim for 1-3 sentences unless more detail is specifically requested.

Current system state:
- Time: Texas {tx_time} | South Africa {za_time} | Korea {kr_time}
- Gmail: {gm.get('unread', '?')} unread, {gm.get('today', '?')} today
- Workspace: {ws.get('unread', '?')} unread, {ws.get('today', '?')} today
- Projects: {proj_summary}
- Recent events: {log_summary}"""

def call_claude(message):
    if not ANTHROPIC_KEY or ANTHROPIC_KEY == 'sk-ant-REPLACE_ME':
        return None, 'No Anthropic API key configured'
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=ANTHROPIC_KEY)
        response = client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=300,
            system=build_system_prompt(),
            messages=[{'role': 'user', 'content': message}]
        )
        text = response.content[0].text
        log(f"claude chat — ok — {len(text)} chars")
        return text, None
    except Exception as e:
        log(f"claude chat — error — {e}")
        return None, str(e)

# ── HTTP SERVER ───────────────────────────────────────────────────────────────

class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args): pass

    def send_cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_cors()
        self.end_headers()

    def send_json(self, data, status=200):
        payload = json.dumps(data).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_cors()
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        if self.path == '/metrics':
            with cache_lock:
                self.send_json(cache)

        elif self.path == '/projects':
            with projects_lock:
                self.send_json(list(projects_cache))

        elif self.path == '/log':
            with log_lock:
                self.send_json(list(log_buffer)[:20])

        elif self.path == '/health':
            self.send_json({'status': 'ok'})

        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path == '/chat':
            length = int(self.headers.get('Content-Length', 0))
            body   = self.rfile.read(length)
            try:
                data    = json.loads(body)
                message = data.get('message', '').strip()
                if not message:
                    self.send_json({'error': 'empty message'}, 400)
                    return
                log(f"voice command: {message[:60]}")
                text, err = call_claude(message)
                if err:
                    self.send_json({'error': err}, 500)
                else:
                    self.send_json({'response': text})
            except Exception as e:
                self.send_json({'error': str(e)}, 500)
        else:
            self.send_response(404)
            self.end_headers()

# ── MAIN ─────────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    log("=" * 50)
    log("NIGHTFALL COMMAND CENTER BACKEND")
    log("=" * 50)

    # Initial project scan
    result = scan_projects()
    with projects_lock:
        projects_cache.extend(result)

    # Authenticate and initial email poll
    for account in ACCOUNTS:
        log(f"Connecting {account['email']}...")
        result = poll_account(account)
        with cache_lock:
            cache[account['key']] = result

    # Background threads
    threading.Thread(target=poll_loop,     daemon=True).start()
    threading.Thread(target=projects_loop, daemon=True).start()

    log(f"Serving on http://localhost:{PORT}")
    server = HTTPServer(('localhost', PORT), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        log("Nightfall backend stopped.")
```

- [ ] **Step 2: Update `backend/requirements.txt`**

Replace the contents of `/mnt/c/Users/ricqua/Desktop/Projects/command-center/backend/requirements.txt` with:

```
google-auth>=2.0.0
google-auth-oauthlib>=1.0.0
google-auth-httplib2>=0.1.0
google-api-python-client>=2.0.0
anthropic>=0.25.0
requests>=2.31.0
```

- [ ] **Step 3: Install new dependencies**

```bash
cd /mnt/c/Users/ricqua/Desktop/Projects/command-center/backend
pip install -r requirements.txt
```

Expected: `anthropic` and `requests` install successfully.

- [ ] **Step 4: Test the backend starts**

```bash
cd /mnt/c/Users/ricqua/Desktop/Projects/command-center/backend
python3 server.py
```

Expected output includes:
```
[HH:MM:SS] NIGHTFALL COMMAND CENTER BACKEND
[HH:MM:SS] projects scan — 1 found
[HH:MM:SS] Serving on http://localhost:5050
```

- [ ] **Step 5: Test `/projects` endpoint**

In a second terminal:
```bash
curl http://localhost:5050/projects
```

Expected: JSON array like `[{"name":"command-center","last_modified":"2026-06-14T...","age":"active"}]`

- [ ] **Step 6: Test `/log` endpoint**

```bash
curl http://localhost:5050/log
```

Expected: JSON array of recent log entries with `time` and `message` fields.

- [ ] **Step 7: Commit**

```bash
git add backend/server.py backend/requirements.txt
git commit -m "feat: add /projects /chat /log endpoints and config loading"
```

---

## Task 8: `js/projects.js` — Projects panel, focus reminder, activity log

**Files:**
- Create: `js/projects.js`

- [ ] **Step 1: Create `js/projects.js`**

Create `/mnt/c/Users/ricqua/Desktop/Projects/command-center/js/projects.js`:

```javascript
(function() {
  const BACKEND = 'http://localhost:5050';
  let projectsData = [];
  let focusIndex   = 0;

  // ── Shared log event emitter (used by email.js and voice.js too) ──
  const localLogEntries = [];
  window.logEvent = function(msg) {
    const now = new Date();
    const t = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    localLogEntries.unshift({ time: t, message: msg });
    if (localLogEntries.length > 50) localLogEntries.pop();
    renderLog();
  };

  // ── Render project cards ──
  function ageClass(age) {
    if (age === 'active') return '';
    if (age === 'recent') return 'age-recent';
    return 'age-idle';
  }

  function fmtDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
  }

  function renderProjects(projects) {
    const list = document.getElementById('project-list');
    if (!list) return;
    if (!projects.length) {
      list.innerHTML = '<div style="font-size:9px;color:var(--text-muted);letter-spacing:2px;">NO PROJECTS FOUND</div>';
      return;
    }
    list.innerHTML = projects.map(p => `
      <div class="session-card ${ageClass(p.age)}" style="margin-bottom:6px;">
        <div class="corner corner-tl"></div><div class="corner corner-br"></div>
        <div class="session-title">${p.name.toUpperCase()}</div>
        <div class="session-meta">${fmtDate(p.last_modified)}</div>
        <span class="session-status ${p.age === 'active' ? 'live' : 'idle'}" style="display:inline-block;font-size:8px;padding:1px 6px;margin-top:3px;letter-spacing:2px;${p.age === 'active' ? 'background:rgba(0,255,136,0.1);color:var(--green);border:1px solid var(--green-dim);' : 'background:rgba(0,80,100,0.2);color:var(--text-dim);border:1px solid var(--text-muted);'}">
          ${p.age === 'active' ? '● ACTIVE' : p.age === 'recent' ? '◎ RECENT' : '○ IDLE'}
        </span>
      </div>`).join('');

    // Update KPI + bottom bar
    const count = projects.length;
    const activeCount = projects.filter(p => p.age === 'active').length;
    const kpiEl = document.getElementById('kpi-projects');
    const kpiSubEl = document.getElementById('kpi-projects-sub');
    const bbEl  = document.getElementById('bb-projects');
    const bbBarEl = document.getElementById('bb-projects-bar');
    const bbTrendEl = document.getElementById('bb-projects-trend');
    if (kpiEl) kpiEl.textContent = count;
    if (kpiSubEl) kpiSubEl.textContent = `↑ ${activeCount} ACTIVE`;
    if (bbEl) bbEl.textContent = count;
    if (bbBarEl) bbBarEl.style.width = Math.min(count * 10, 100) + '%';
    if (bbTrendEl) bbTrendEl.textContent = `${activeCount} ACTIVE`;
  }

  // ── Focus reminder ──
  function renderFocus(projects) {
    if (!projects.length) return;
    const sorted = [...projects].sort((a, b) => b.last_modified.localeCompare(a.last_modified));
    const p = sorted[focusIndex % sorted.length];
    const el = document.getElementById('focus-project');
    const meta = document.getElementById('focus-meta');
    if (el) el.textContent = p.name.toUpperCase();
    if (meta) meta.textContent = `LAST ACTIVE: ${fmtDate(p.last_modified)}`;
  }

  function rotateFocus() {
    focusIndex++;
    renderFocus(projectsData);
  }

  // ── Activity log ──
  function renderLog() {
    const feed = document.getElementById('log-feed');
    if (!feed) return;
    feed.innerHTML = localLogEntries.slice(0, 15).map(e =>
      `<div class="log-entry"><span class="log-time">${e.time}</span>${e.message}</div>`
    ).join('');
  }

  async function fetchBackendLog() {
    try {
      const res  = await fetch(`${BACKEND}/log`, { signal: AbortSignal.timeout(3000) });
      const data = await res.json();
      data.forEach(e => {
        const exists = localLogEntries.some(l => l.time === e.time && l.message === e.message);
        if (!exists) localLogEntries.push(e);
      });
      localLogEntries.sort((a, b) => b.time.localeCompare(a.time));
      if (localLogEntries.length > 50) localLogEntries.splice(50);
      renderLog();
    } catch { /* backend offline — show frontend-only log */ }
  }

  // ── Projects fetch ──
  async function fetchProjects() {
    try {
      const res  = await fetch(`${BACKEND}/projects`, { signal: AbortSignal.timeout(5000) });
      projectsData = await res.json();
      renderProjects(projectsData);
      renderFocus(projectsData);
      window.logEvent(`projects scan — ${projectsData.length} found`);
    } catch {
      renderProjects([]);
    }
  }

  // ── Latency sim (bottom bar) ──
  setInterval(() => {
    const ms = Math.round(120 + Math.random() * 80);
    const latEl    = document.getElementById('latency');
    const latBar   = document.getElementById('latency-bar');
    const latTrend = document.getElementById('latency-trend');
    if (latEl)    latEl.textContent = ms + 'ms';
    if (latBar)   latBar.style.width = Math.min(ms / 4, 100) + '%';
    if (latTrend) {
      if (ms < 160) { latTrend.textContent = '↑ FAST'; latTrend.className = 'bk-trend'; }
      else          { latTrend.textContent = '↓ ELEVATED'; latTrend.className = 'bk-trend down'; }
    }
  }, 1800);

  // ── Init ──
  fetchProjects();
  fetchBackendLog();
  setInterval(fetchProjects,   60000);
  setInterval(fetchBackendLog, 15000);
  setInterval(rotateFocus,     300000); // rotate focus every 5 min
})();
```

- [ ] **Step 2: Verify in browser (backend running)**

Open `index.html`. Expected:
- Left panel shows project cards for each subdirectory in `C:\Users\ricqua\Desktop\Projects\`
- Focus card shows most recently modified project
- Activity log shows backend events (email polls, project scans)
- Bottom bar `PROJECTS FOUND` cell updates with real count

- [ ] **Step 3: Commit**

```bash
git add js/projects.js
git commit -m "feat: add projects.js with project cards, focus reminder, activity log"
```

---

## Task 9: `js/voice.js` — STT → Claude → ElevenLabs/browser TTS

**Files:**
- Create: `js/voice.js`

- [ ] **Step 1: Create `js/voice.js`**

Create `/mnt/c/Users/ricqua/Desktop/Projects/command-center/js/voice.js`:

```javascript
(function() {
  const BACKEND = 'http://localhost:5050';

  const micBtn       = document.getElementById('mic-btn');
  const aiCore       = document.getElementById('ai-core');
  const transcriptEl = document.getElementById('voice-transcript');
  const responseEl   = document.getElementById('voice-response');
  const waveformBars = document.querySelectorAll('.wave-bar');
  const voiceMode    = document.getElementById('bb-voice-mode');
  const voiceStatus  = document.getElementById('bb-voice-status');

  let elevenLabsKey     = null;
  let elevenLabsVoiceId = '21m00Tcm4TlvDq8ikWAM';
  let usingElevenLabs   = false;

  // ── Fetch ElevenLabs config from backend config endpoint (we expose it safely) ──
  // The frontend never stores the key — it asks the backend to do TTS server-side
  // if ElevenLabs is configured. We use backend as proxy to keep key off the browser.

  // ── Waveform ──
  function setWave(active, color) {
    waveformBars.forEach(b => {
      b.style.background = color || 'var(--cyan-dim)';
      if (active) b.classList.add('active');
      else { b.classList.remove('active'); b.style.height = '4px'; }
    });
  }

  // ── State management ──
  function setState(state) {
    aiCore.classList.remove('listening', 'speaking');
    if (state === 'listening') {
      aiCore.classList.add('listening');
      setWave(true, 'var(--red)');
      micBtn.classList.add('active');
      if (voiceStatus) voiceStatus.textContent = 'LISTENING';
    } else if (state === 'speaking') {
      aiCore.classList.add('speaking');
      setWave(true, 'var(--green)');
      micBtn.classList.remove('active');
      if (voiceStatus) voiceStatus.textContent = 'SPEAKING';
    } else {
      setWave(false);
      micBtn.classList.remove('active');
      if (voiceStatus) voiceStatus.textContent = 'READY';
    }
  }

  // ── Browser TTS fallback ──
  let voices = [];
  function loadVoices() { voices = speechSynthesis.getVoices(); }
  loadVoices();
  speechSynthesis.onvoiceschanged = loadVoices;

  function pickVoice() {
    const preferred = ['Google UK English Male', 'Microsoft David', 'Daniel', 'Alex'];
    for (const name of preferred) {
      const match = voices.find(v => v.name.includes(name));
      if (match) return match;
    }
    return voices.find(v => v.lang.startsWith('en')) || voices[0] || null;
  }

  function speakBrowser(text, onEnd) {
    speechSynthesis.cancel();
    const utt    = new SpeechSynthesisUtterance(text);
    utt.voice    = pickVoice();
    utt.pitch    = 0.85;
    utt.rate     = 0.92;
    utt.volume   = 1;
    utt.onstart  = () => setState('speaking');
    utt.onend    = () => { setState('idle'); if (onEnd) onEnd(); };
    utt.onerror  = () => { setState('idle'); if (onEnd) onEnd(); };
    speechSynthesis.speak(utt);
    if (voiceMode) voiceMode.textContent = 'BROWSER TTS';
  }

  // ── ElevenLabs TTS via backend proxy ──
  async function speakElevenLabs(text, onEnd) {
    try {
      setState('speaking');
      if (voiceMode) voiceMode.textContent = 'ELEVENLABS';
      const res = await fetch(`${BACKEND}/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error(`TTS status ${res.status}`);
      const blob    = await res.blob();
      const url     = URL.createObjectURL(blob);
      const audio   = new Audio(url);
      audio.onended = () => { URL.revokeObjectURL(url); setState('idle'); if (onEnd) onEnd(); };
      audio.onerror = () => { URL.revokeObjectURL(url); speakBrowser(text, onEnd); };
      await audio.play();
    } catch {
      speakBrowser(text, onEnd);
    }
  }

  async function speak(text) {
    responseEl.textContent = text;
    const usable = await checkElevenLabs();
    if (usable) {
      await speakElevenLabs(text, () => setTimeout(() => { responseEl.textContent = ''; }, 3000));
    } else {
      speakBrowser(text, () => setTimeout(() => { responseEl.textContent = ''; }, 3000));
    }
    if (window.logEvent) window.logEvent(`voice response — ${text.slice(0, 40)}...`);
  }

  async function checkElevenLabs() {
    if (usingElevenLabs !== null && usingElevenLabs !== undefined) return usingElevenLabs;
    try {
      const res  = await fetch(`${BACKEND}/config`, { signal: AbortSignal.timeout(2000) });
      const data = await res.json();
      usingElevenLabs = !!data.elevenlabs_configured;
      if (voiceMode) voiceMode.textContent = usingElevenLabs ? 'ELEVENLABS' : 'BROWSER TTS';
    } catch {
      usingElevenLabs = false;
    }
    return usingElevenLabs;
  }

  // ── Call Claude via backend ──
  async function askClaude(message) {
    try {
      transcriptEl.textContent = message.toUpperCase();
      const res = await fetch(`${BACKEND}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
        signal: AbortSignal.timeout(15000),
      });
      const data = await res.json();
      if (data.error) {
        speak('I encountered an error. ' + data.error);
        return;
      }
      speak(data.response);
    } catch {
      transcriptEl.classList.add('error');
      transcriptEl.textContent = 'BACKEND OFFLINE';
      speak('Backend is offline. Please start the Nightfall server.');
    }
  }

  // ── STT ──
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SR) {
    micBtn.disabled = true;
    micBtn.title    = 'Speech recognition not supported. Use Chrome or Edge.';
    transcriptEl.textContent = 'STT UNAVAILABLE — USE CHROME';
    if (voiceMode) voiceMode.textContent = 'NO STT';
  } else {
    const recognition         = new SR();
    recognition.continuous    = false;
    recognition.interimResults = true;
    recognition.lang          = 'en-US';

    let isListening = false;

    function startListening() {
      if (isListening) return;
      isListening = true;
      speechSynthesis.cancel();
      setState('listening');
      transcriptEl.textContent = 'LISTENING...';
      transcriptEl.className   = 'voice-transcript heard';
      if (window.logEvent) window.logEvent('voice — listening started');
      recognition.start();
    }

    function stopListening() {
      if (!isListening) return;
      isListening = false;
      setState('idle');
      recognition.stop();
    }

    micBtn.addEventListener('click', () => {
      if (isListening) stopListening();
      else startListening();
    });

    recognition.onresult = e => {
      let interim = '', final = '';
      for (const r of e.results) {
        if (r.isFinal) final += r[0].transcript;
        else interim += r[0].transcript;
      }
      transcriptEl.textContent = (final || interim).toUpperCase();
      if (final) {
        stopListening();
        if (window.logEvent) window.logEvent(`voice command: ${final.trim().slice(0, 40)}`);
        askClaude(final.trim());
      }
    };

    recognition.onerror = e => {
      transcriptEl.textContent = 'ERROR: ' + e.error.toUpperCase();
      transcriptEl.className   = 'voice-transcript error';
      stopListening();
    };

    recognition.onend = () => {
      if (isListening) stopListening();
      transcriptEl.classList.remove('heard');
    };

    // Greet on load
    setTimeout(async () => {
      await checkElevenLabs();
      speak('Nightfall online. Voice interface ready. Click the microphone to speak.');
    }, 1500);
  }
})();
```

- [ ] **Step 2: Add `/tts` and `/config` endpoints to `backend/server.py`**

Add these two methods to the `Handler` class in `backend/server.py`, inside `do_GET` and `do_POST`:

In `do_GET`, add after the `/log` block:
```python
        elif self.path == '/config':
            el_key = CONFIG.get('elevenlabs_api_key', '')
            self.send_json({
                'elevenlabs_configured': bool(el_key and el_key != 'REPLACE_ME'),
            })
```

In `do_POST`, add after the `/chat` block:
```python
        elif self.path == '/tts':
            length = int(self.headers.get('Content-Length', 0))
            body   = self.rfile.read(length)
            try:
                data    = json.loads(body)
                text    = data.get('text', '').strip()
                el_key  = CONFIG.get('elevenlabs_api_key', '')
                voice_id = CONFIG.get('elevenlabs_voice_id', '21m00Tcm4TlvDq8ikWAM')
                if not text or not el_key or el_key == 'REPLACE_ME':
                    self.send_response(503)
                    self.end_headers()
                    return
                import requests as req_lib
                resp = req_lib.post(
                    f'https://api.elevenlabs.io/v1/text-to-speech/{voice_id}',
                    headers={
                        'xi-api-key': el_key,
                        'Content-Type': 'application/json',
                        'Accept': 'audio/mpeg',
                    },
                    json={'text': text, 'model_id': 'eleven_turbo_v2',
                          'voice_settings': {'stability': 0.5, 'similarity_boost': 0.75}},
                    timeout=10,
                )
                if resp.status_code != 200:
                    self.send_response(502)
                    self.end_headers()
                    return
                audio = resp.content
                self.send_response(200)
                self.send_header('Content-Type', 'audio/mpeg')
                self.send_header('Content-Length', str(len(audio)))
                self.send_cors()
                self.end_headers()
                self.wfile.write(audio)
                log(f"elevenlabs tts — ok — {len(text)} chars")
            except Exception as e:
                log(f"elevenlabs tts — error — {e}")
                self.send_response(500)
                self.end_headers()
```

- [ ] **Step 3: Restart backend and verify `/config`**

```bash
# Stop running backend (Ctrl+C), then:
cd /mnt/c/Users/ricqua/Desktop/Projects/command-center/backend
python3 server.py
```

In a second terminal:
```bash
curl http://localhost:5050/config
```

Expected (before real key set): `{"elevenlabs_configured": false}`

- [ ] **Step 4: Verify voice in browser**

Open `index.html` in Chrome. Expected:
- After 1.5 seconds, Nightfall speaks the greeting via browser TTS
- Click mic button — button turns red, core turns red, transcript shows LISTENING
- Say "hello" — transcript shows your words, Claude responds, core turns green while speaking
- Bottom bar voice cell shows `BROWSER TTS` (or `ELEVENLABS` if key is configured)

- [ ] **Step 5: Commit**

```bash
git add js/voice.js backend/server.py
git commit -m "feat: add voice.js with Claude + ElevenLabs/browser TTS, add /tts and /config endpoints"
```

---

## Task 10: Wire in real API keys and verify end-to-end

**Files:**
- Modify: `config.json` (local only — never committed)

- [ ] **Step 1: Add your Anthropic API key to `config.json`**

Edit `/mnt/c/Users/ricqua/Desktop/Projects/command-center/config.json`:
- Replace `sk-ant-REPLACE_ME` with your real Anthropic API key from https://console.anthropic.com

- [ ] **Step 2: Restart backend**

```bash
cd /mnt/c/Users/ricqua/Desktop/Projects/command-center/backend
python3 server.py
```

- [ ] **Step 3: Test Claude via curl**

```bash
curl -X POST http://localhost:5050/chat \
  -H 'Content-Type: application/json' \
  -d '{"message": "what time is it in South Africa?"}'
```

Expected: `{"response": "In South Africa it is currently HH:MM..."}` (real time, real Claude response).

- [ ] **Step 4: Test voice end-to-end in browser**

Open `index.html`. Click mic. Say *"how many unread emails do I have?"*

Expected: Claude responds with the actual Gmail unread count from the backend cache, spoken aloud via browser TTS.

- [ ] **Step 5: (Optional) Add ElevenLabs key**

Edit `config.json`, add your ElevenLabs API key. Restart backend.

```bash
curl http://localhost:5050/config
```

Expected: `{"elevenlabs_configured": true}`

Open `index.html`. Click mic, speak. Expected: response plays with ElevenLabs voice. Bottom bar shows `ELEVENLABS`.

- [ ] **Step 6: Final verification — no scrollbars**

Open `index.html` fullscreen (F11) on 1920×1080 display. Verify: no vertical or horizontal scrollbar visible at any zoom level. All 5 panels visible. No content cut off.

- [ ] **Step 7: Final commit**

```bash
git add .
git status  # verify config.json is NOT listed
git commit -m "feat: command center refactor complete — fullscreen, Claude voice, live projects"
```

---

## Self-Review Checklist

- [x] **Viewport lock** — `height: 100vh; overflow: hidden` on both `body` and `.grid` — Task 2
- [x] **No scrollbars** — all panels use `overflow: hidden`, log/email use fixed max heights — Task 2
- [x] **File split** — 5 JS modules + 1 CSS file, `index.html` is shell only — Tasks 2–9
- [x] **Projects from dir scan** — `/projects` endpoint in server.py scans real path — Task 7
- [x] **Focus reminder** — rotates every 5 min in projects.js — Task 8
- [x] **Activity log** — real backend events + frontend events merged — Tasks 7, 8
- [x] **Email right panel first** — Gmail at top of right panel in index.html — Task 3
- [x] **8 email threads** — `fetch_recent(service, n=8)` in server.py — Task 7
- [x] **Claude voice** — `/chat` endpoint + voice.js STT→Claude→TTS flow — Tasks 7, 9
- [x] **ElevenLabs TTS** — `/tts` proxy endpoint + fallback to browser TTS — Tasks 7, 9
- [x] **Config loading** — `config.json` read on startup, gitignored — Tasks 1, 7
- [x] **Graceful degradation** — all offline/missing-key states handled — Tasks 6, 9
- [x] **Contrast** — updated CSS variables in style.css — Task 2
- [x] **1080p typography** — font sizes bumped ~10% — Task 2
- [x] **Right panel 300px** — grid column updated — Task 2
- [x] **KPI active projects** — real count from /projects scan — Task 8
- [x] **gitignore** — config.json, tokens, credentials all excluded — Task 1
