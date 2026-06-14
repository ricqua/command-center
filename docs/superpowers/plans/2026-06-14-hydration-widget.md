# Hydration Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a hydration tracking widget to the right panel showing a 14-glass daily target, time-of-day progress marker, drink button with urgency coloring, and reset with confirmation.

**Architecture:** Pure frontend — no backend. `js/hydration.js` owns all logic: localStorage persistence, status calculation, rendering, and button handlers. CSS styles live in `style.css`. HTML section appended to the right panel in `index.html`.

**Tech Stack:** Vanilla JS, localStorage, CSS custom properties (existing theme vars).

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `js/hydration.js` | Create | Storage, status calc, marker position, render, button handlers, 60s interval |
| `index.html` | Modify | `// HYDRATION` section in right panel + script tag |
| `style.css` | Modify | Hydration bar, time marker, drink/reset button states |

---

### Task 1: Add hydration CSS styles

**Files:**
- Modify: `/mnt/c/Users/ricqua/Desktop/Projects/command-center/style.css`

- [ ] **Step 1: Read the end of style.css to find where to append**

Read `/mnt/c/Users/ricqua/Desktop/Projects/command-center/style.css` to confirm the last line, then append the following block:

```css
/* ── HYDRATION WIDGET ── */
.hydration-bar-wrap {
  position: relative;
  margin: 6px 0 10px;
}

.hydration-bar {
  height: 8px;
  background: rgba(0,245,255,0.06);
  border: 1px solid var(--border);
  border-radius: 2px;
  overflow: visible;
  position: relative;
}

.hydration-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--blue), var(--cyan));
  border-radius: 2px;
  transition: width 0.4s ease;
}

.hydration-marker {
  position: absolute;
  top: -5px;
  transform: translateX(-50%);
  font-size: 8px;
  color: var(--amber);
  pointer-events: none;
  transition: left 1s linear;
}

.hydration-count {
  font-size: 11px;
  color: var(--cyan);
  letter-spacing: 2px;
  text-align: right;
  margin-top: 2px;
  text-shadow: 0 0 8px var(--cyan);
}

.hydration-btns {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}

.hydration-drink-btn {
  flex: 2;
  padding: 5px 0;
  border-radius: 2px;
  border: 1px solid var(--cyan-dim);
  background: rgba(0,60,80,0.4);
  color: var(--cyan);
  font-family: var(--font);
  font-size: 9px;
  letter-spacing: 2px;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s, color 0.2s;
}

.hydration-drink-btn:hover {
  background: rgba(0,90,110,0.5);
  border-color: var(--cyan);
}

.hydration-drink-btn.soon {
  border-color: var(--amber);
  color: var(--amber);
  background: rgba(80,50,0,0.3);
}

.hydration-drink-btn.overdue {
  border-color: var(--red);
  color: var(--red);
  background: rgba(60,0,20,0.4);
  animation: overdue-pulse 1.2s ease-in-out infinite;
}

@keyframes overdue-pulse {
  0%, 100% { box-shadow: 0 0 4px rgba(255,51,85,0.3); }
  50% { box-shadow: 0 0 14px rgba(255,51,85,0.8); }
}

.hydration-reset-btn {
  flex: 1;
  padding: 5px 0;
  border-radius: 2px;
  border: 1px solid var(--text-muted);
  background: transparent;
  color: var(--text-muted);
  font-family: var(--font);
  font-size: 9px;
  letter-spacing: 2px;
  cursor: pointer;
  transition: border-color 0.2s, color 0.2s;
}

.hydration-reset-btn:hover { border-color: var(--text-dim); color: var(--text-dim); }

.hydration-reset-btn.confirm {
  border-color: var(--amber);
  color: var(--amber);
}

.hydration-status {
  font-size: 8px;
  letter-spacing: 2px;
  margin-top: 5px;
  color: var(--text-muted);
}

.hydration-status.on-track { color: var(--green); }
.hydration-status.soon     { color: var(--amber); }
.hydration-status.overdue  { color: var(--red); }
```

- [ ] **Step 2: Commit**

```bash
git add style.css
git commit -m "feat: add hydration widget CSS styles"
```

---

### Task 2: Add HTML section to right panel

**Files:**
- Modify: `/mnt/c/Users/ricqua/Desktop/Projects/command-center/index.html`

- [ ] **Step 1: Read index.html to find the right panel closing tag**

Read `/mnt/c/Users/ricqua/Desktop/Projects/command-center/index.html`. Find this block (around line 132):

```html
    <div class="panel-label">// RECENT · WORKSPACE</div>
    <div id="ws-recent" class="email-recent"></div>
  </div>
```

Replace it with:

```html
    <div class="panel-label">// RECENT · WORKSPACE</div>
    <div id="ws-recent" class="email-recent"></div>

    <!-- Hydration -->
    <div class="panel-label">// HYDRATION</div>
    <div class="kpi-card" style="--delay:0.5s; padding:8px 11px;">
      <div class="corner corner-tl"></div><div class="corner corner-br"></div>
      <div class="hydration-bar-wrap">
        <div class="hydration-bar">
          <div class="hydration-bar-fill" id="hyd-bar-fill" style="width:0%"></div>
          <div class="hydration-marker" id="hyd-marker" style="left:0%">▲</div>
        </div>
      </div>
      <div class="hydration-count" id="hyd-count">0 / 14</div>
      <div class="hydration-btns">
        <button class="hydration-drink-btn" id="hyd-drink">+ DRINK</button>
        <button class="hydration-reset-btn" id="hyd-reset">RESET</button>
      </div>
      <div class="hydration-status" id="hyd-status">—</div>
    </div>
  </div>
```

- [ ] **Step 2: Add hydration.js script tag**

Find the script tags at the bottom of index.html:
```html
<script src="js/anthropic.js"></script>
</body>
```

Replace with:
```html
<script src="js/anthropic.js"></script>
<script src="js/hydration.js"></script>
</body>
```

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add hydration widget HTML to right panel"
```

---

### Task 3: Create js/hydration.js

**Files:**
- Create: `/mnt/c/Users/ricqua/Desktop/Projects/command-center/js/hydration.js`

- [ ] **Step 1: Create the file with this exact content**

```javascript
(function () {
  const GOAL        = 14;
  const OFFICE_START = 8;   // 08:00
  const OFFICE_END   = 18;  // 18:00
  const STORAGE_KEY  = 'nf_hydration';

  // ── Storage ──
  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return 0;
      const data = JSON.parse(raw);
      if (data.date !== today()) return 0;
      return data.count || 0;
    } catch { return 0; }
  }

  function save(count) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: today(), count }));
  }

  // ── Status calculation ──
  function expectedCount() {
    const now    = new Date();
    const hour   = now.getHours() + now.getMinutes() / 60;
    const clamped = Math.min(Math.max(hour, OFFICE_START), OFFICE_END);
    const elapsed = clamped - OFFICE_START;
    return Math.floor((elapsed / (OFFICE_END - OFFICE_START)) * GOAL);
  }

  function isOfficeHours() {
    const hour = new Date().getHours() + new Date().getMinutes() / 60;
    return hour >= OFFICE_START && hour < OFFICE_END;
  }

  function getStatus(count) {
    if (!isOfficeHours()) return 'idle';
    const expected = expectedCount();
    const diff = expected - count;
    if (diff <= 0) return 'on-track';
    if (diff === 1) return 'soon';
    return 'overdue';
  }

  // ── Render ──
  function render(count) {
    const fillEl   = document.getElementById('hyd-bar-fill');
    const markerEl = document.getElementById('hyd-marker');
    const countEl  = document.getElementById('hyd-count');
    const drinkBtn = document.getElementById('hyd-drink');
    const statusEl = document.getElementById('hyd-status');
    if (!fillEl) return;

    const fillPct   = Math.min((count / GOAL) * 100, 100);
    const markerPct = Math.min((expectedCount() / GOAL) * 100, 100);

    fillEl.style.width   = fillPct + '%';
    markerEl.style.left  = markerPct + '%';
    countEl.textContent  = `${count} / ${GOAL}`;

    const status = getStatus(count);

    drinkBtn.className = 'hydration-drink-btn';
    statusEl.className = 'hydration-status';

    if (status === 'on-track') {
      statusEl.textContent = 'ON TRACK';
      statusEl.classList.add('on-track');
    } else if (status === 'soon') {
      drinkBtn.classList.add('soon');
      statusEl.textContent = 'DRINK SOON';
      statusEl.classList.add('soon');
    } else if (status === 'overdue') {
      drinkBtn.classList.add('overdue');
      statusEl.textContent = 'OVERDUE';
      statusEl.classList.add('overdue');
    } else {
      statusEl.textContent = `${count} OF ${GOAL} TODAY`;
    }
  }

  // ── State ──
  let count = load();
  let resetPending = false;
  let resetTimer   = null;

  // ── Drink button ──
  document.getElementById('hyd-drink').addEventListener('click', () => {
    if (count >= GOAL) return;
    count++;
    save(count);
    render(count);
    if (window.logEvent) window.logEvent(`hydration — ${count}/${GOAL} glasses`);
  });

  // ── Reset button ──
  const resetBtn = document.getElementById('hyd-reset');
  resetBtn.addEventListener('click', () => {
    if (!resetPending) {
      resetPending = true;
      resetBtn.textContent = 'CONFIRM?';
      resetBtn.classList.add('confirm');
      resetTimer = setTimeout(() => {
        resetPending = false;
        resetBtn.textContent = 'RESET';
        resetBtn.classList.remove('confirm');
      }, 3000);
    } else {
      clearTimeout(resetTimer);
      resetPending = false;
      resetBtn.textContent = 'RESET';
      resetBtn.classList.remove('confirm');
      count = 0;
      save(0);
      render(0);
      if (window.logEvent) window.logEvent('hydration — reset');
    }
  });

  // ── Init + 60s interval ──
  render(count);
  setInterval(() => render(count), 60000);
})();
```

- [ ] **Step 2: Commit**

```bash
git add js/hydration.js
git commit -m "feat: add hydration.js tracker with localStorage, status logic, and reset confirmation"
```

---

### Task 4: Smoke test in browser

- [ ] **Step 1: Open `index.html` in browser**

Confirm:
- `// HYDRATION` section appears at the bottom of the right panel
- Progress bar shows `0 / 14`
- `▲` marker is positioned based on current time of day
- If between 08:00–18:00: status shows `ON TRACK`, `DRINK SOON`, or `OVERDUE` depending on time
- If outside office hours: status shows `0 OF 14 TODAY`

- [ ] **Step 2: Click `+ DRINK` several times**

Confirm:
- Count increments: `1 / 14`, `2 / 14`, etc.
- Progress bar fill grows
- Reload the page — count should persist (localStorage)

- [ ] **Step 3: Test reset confirmation**

Click `RESET` once — button should change to `CONFIRM?` (amber). Wait 3 seconds — should revert to `RESET`. Click `RESET` again then `CONFIRM?` quickly — count should reset to 0.

- [ ] **Step 4: Test urgency states (during office hours only)**

Open browser console and run:
```javascript
localStorage.setItem('nf_hydration', JSON.stringify({ date: new Date().toISOString().slice(0,10), count: 0 }));
location.reload();
```
At mid-morning (e.g., 10am, expected ~3 glasses), with count=0 the drink button should be red and pulsing, status `OVERDUE`.

- [ ] **Step 5: Commit any fixes, then done**
