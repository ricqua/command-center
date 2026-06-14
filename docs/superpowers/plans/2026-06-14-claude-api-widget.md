# Claude API Usage Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Claude API heatmap widget to the left panel showing token usage over the past year, estimated cost, and remaining account credit.

**Architecture:** Backend polls the Anthropic usage API hourly and caches the result in memory; a new `/anthropic-usage` route serves it. A new `js/anthropic.js` file fetches that route and renders the heatmap, balance bar, and stats row. The `config.json` stores the user's entered credit balance.

**Tech Stack:** Python (stdlib `urllib`) for backend API call; vanilla JS + CSS grid for heatmap; existing `kpi-card` / `bk-bar` CSS patterns for balance bar.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `backend/server.py` | Modify | Add `anthropic_usage_cache`, `fetch_anthropic_usage()`, `usage_loop()`, `/anthropic-usage` route, expose `anthropic_credit_usd` from `/config` |
| `js/anthropic.js` | Create | Fetch `/anthropic-usage` + `/config`, render heatmap, balance bar, stats row |
| `index.html` | Modify | Insert `// CLAUDE API` section above `// PROJECTS` in left panel |
| `style.css` | Modify | Add heatmap grid, cell, day-label, month-label styles |
| `config.json` | Modify | Add `"anthropic_credit_usd": 50.00` field |

---

### Task 1: Add `anthropic_credit_usd` to config and expose via `/config`

**Files:**
- Modify: `config.json`
- Modify: `backend/server.py:269-273` (the `/config` GET handler)

- [ ] **Step 1: Add field to config.json**

Open `config.json` and add the new field (set to your actual current balance):

```json
{
  "anthropic_api_key": "...",
  "elevenlabs_api_key": "REPLACE_ME",
  "elevenlabs_voice_id": "21m00Tcm4TlvDq8ikWAM",
  "projects_dir": "C:\\Users\\ricqua\\Desktop\\Projects",
  "claude_model": "claude-haiku-4-5",
  "anthropic_credit_usd": 50.00
}
```

- [ ] **Step 2: Expose it from the `/config` endpoint**

In `backend/server.py`, find the `/config` GET handler (around line 269) and replace it:

```python
elif self.path == '/config':
    el_key = CONFIG.get('elevenlabs_api_key', '')
    self.send_json({
        'elevenlabs_configured': bool(el_key and el_key != 'REPLACE_ME'),
        'anthropic_credit_usd': CONFIG.get('anthropic_credit_usd', 0),
    })
```

- [ ] **Step 3: Verify by restarting backend and curling**

```bash
curl http://localhost:5050/config
```

Expected output:
```json
{"elevenlabs_configured": false, "anthropic_credit_usd": 50.0}
```

- [ ] **Step 4: Commit**

```bash
git add config.json backend/server.py
git commit -m "feat: expose anthropic_credit_usd from /config"
```

---

### Task 2: Add Anthropic usage fetch + `/anthropic-usage` route to backend

**Files:**
- Modify: `backend/server.py`

- [ ] **Step 1: Add usage cache variables after the projects cache block (around line 61)**

```python
# ── ANTHROPIC USAGE CACHE ────────────────────────────────────────────────────

anthropic_usage_cache = {}
anthropic_usage_lock  = threading.Lock()
```

- [ ] **Step 2: Add `fetch_anthropic_usage()` function after the projects scan section (after line ~178)**

```python
# ── ANTHROPIC USAGE FETCH ────────────────────────────────────────────────────

def fetch_anthropic_usage():
    if not ANTHROPIC_KEY or ANTHROPIC_KEY.startswith('sk-ant-REPLACE'):
        log("anthropic usage — no api key")
        return {}
    try:
        import urllib.request
        end   = datetime.date.today()
        start = end - datetime.timedelta(days=364)
        url   = (
            f"https://api.anthropic.com/v1/usage/tokens"
            f"?start_time={start.isoformat()}T00:00:00Z"
            f"&end_time={end.isoformat()}T23:59:59Z"
            f"&granularity=daily"
        )
        req = urllib.request.Request(url, headers={
            'x-api-key':         ANTHROPIC_KEY,
            'anthropic-version': '2023-06-01',
        })
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())

        # Haiku 4.5 pricing: $0.25/M input, $1.25/M output
        INPUT_PRICE  = 0.25  / 1_000_000
        OUTPUT_PRICE = 1.25  / 1_000_000

        dates, input_tokens, output_tokens, cost_usd = [], [], [], []
        for entry in data.get('data', []):
            d = entry.get('timestamp', '')[:10]
            inp  = entry.get('input_tokens', 0)
            out  = entry.get('output_tokens', 0)
            cost = inp * INPUT_PRICE + out * OUTPUT_PRICE
            dates.append(d)
            input_tokens.append(inp)
            output_tokens.append(out)
            cost_usd.append(round(cost, 6))

        log(f"anthropic usage — ok — {len(dates)} days")
        return {
            'dates':         dates,
            'input_tokens':  input_tokens,
            'output_tokens': output_tokens,
            'cost_usd':      cost_usd,
        }
    except Exception as e:
        log(f"anthropic usage — error — {e}")
        return {}


def usage_loop():
    while True:
        result = fetch_anthropic_usage()
        with anthropic_usage_lock:
            anthropic_usage_cache.clear()
            anthropic_usage_cache.update(result)
        time.sleep(3600)
```

- [ ] **Step 3: Add `/anthropic-usage` route to the `do_GET` handler**

In the `do_GET` method, add before the `else` 404 block:

```python
elif self.path == '/anthropic-usage':
    with anthropic_usage_lock:
        self.send_json(dict(anthropic_usage_cache))
```

- [ ] **Step 4: Start the usage loop thread and do an initial fetch in `__main__`**

In the `if __name__ == '__main__':` block, after the existing thread starts (around line 368), add:

```python
initial_usage = fetch_anthropic_usage()
with anthropic_usage_lock:
    anthropic_usage_cache.update(initial_usage)

threading.Thread(target=usage_loop, daemon=True).start()
```

- [ ] **Step 5: Restart backend and verify**

```bash
curl http://localhost:5050/anthropic-usage
```

Expected: JSON with `dates`, `input_tokens`, `output_tokens`, `cost_usd` arrays (may be empty if no usage yet, but no error).

- [ ] **Step 6: Commit**

```bash
git add backend/server.py
git commit -m "feat: add /anthropic-usage endpoint with hourly polling"
```

---

### Task 3: Add heatmap CSS styles

**Files:**
- Modify: `style.css`

- [ ] **Step 1: Append heatmap styles to the end of `style.css`**

```css
/* ── CLAUDE API HEATMAP ── */
.heatmap-wrap {
  display: flex;
  gap: 4px;
  margin-bottom: 4px;
}

.heatmap-day-labels {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-top: 0;
}

.hm-day-label {
  font-size: 7px;
  color: var(--text-muted);
  letter-spacing: 1px;
  height: 7px;
  line-height: 7px;
  width: 18px;
  text-align: right;
}

.heatmap-grid {
  display: grid;
  grid-template-columns: repeat(53, 7px);
  grid-template-rows: repeat(7, 7px);
  gap: 2px;
  grid-auto-flow: column;
}

.heatmap-cell {
  width: 7px;
  height: 7px;
  border-radius: 1px;
}

.hm-0 { background: rgba(0,245,255,0.04); }
.hm-1 { background: rgba(0,180,200,0.25); }
.hm-2 { background: rgba(0,220,240,0.55); }
.hm-3 { background: var(--cyan); box-shadow: 0 0 4px var(--cyan-dim); }

.heatmap-month-labels {
  display: flex;
  margin-left: 22px;
  margin-bottom: 6px;
  position: relative;
  height: 10px;
}

.hm-month-label {
  font-size: 7px;
  color: var(--text-dim);
  letter-spacing: 1px;
  position: absolute;
}

.claude-stats {
  font-size: 8px;
  color: var(--text-dim);
  letter-spacing: 1px;
  margin-top: 4px;
  line-height: 1.6;
}

.claude-balance-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 6px 0 3px;
}

.claude-balance-label {
  font-size: 7px;
  color: var(--text-muted);
  letter-spacing: 2px;
  white-space: nowrap;
}

.claude-balance-amount {
  font-size: 11px;
  color: var(--green);
  text-shadow: 0 0 8px var(--green-dim);
  white-space: nowrap;
}
```

- [ ] **Step 2: Commit**

```bash
git add style.css
git commit -m "feat: add heatmap CSS styles for Claude API widget"
```

---

### Task 4: Add HTML section to left panel

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Insert the `// CLAUDE API` section before `// PROJECTS` in `index.html`**

Find this block in `index.html` (around line 47):
```html
  <div class="panel-left">
    <div class="panel-label">// PROJECTS</div>
    <div id="project-list"></div>
```

Replace it with:
```html
  <div class="panel-left">
    <div class="panel-label">// CLAUDE API</div>
    <div class="kpi-card" style="--delay:0s; padding:8px 11px; margin-bottom:6px;">
      <div class="corner corner-tl"></div><div class="corner corner-br"></div>
      <div class="heatmap-month-labels" id="claude-month-labels"></div>
      <div class="heatmap-wrap">
        <div class="heatmap-day-labels">
          <div class="hm-day-label">MON</div>
          <div class="hm-day-label">TUE</div>
          <div class="hm-day-label">WED</div>
          <div class="hm-day-label">THU</div>
          <div class="hm-day-label">FRI</div>
          <div class="hm-day-label">SAT</div>
          <div class="hm-day-label">SUN</div>
        </div>
        <div class="heatmap-grid" id="claude-heatmap"></div>
      </div>
      <div class="claude-balance-row">
        <div class="claude-balance-label">BALANCE</div>
        <div class="claude-balance-amount" id="claude-balance-amount">$—</div>
        <div style="flex:1;">
          <div class="bk-bar"><div class="bk-bar-fill" id="claude-balance-bar" style="width:0%;background:linear-gradient(90deg,var(--green-dim),var(--green))"></div></div>
        </div>
        <div class="claude-balance-label" id="claude-balance-of">of $—</div>
      </div>
      <div class="claude-stats" id="claude-stats">INPUT — · OUTPUT — · EST. $—</div>
    </div>

    <div class="panel-label">// PROJECTS</div>
    <div id="project-list"></div>
```

- [ ] **Step 2: Add `anthropic.js` script tag at the bottom of `index.html`**

Find the script tags at the bottom of `index.html`:
```html
<script src="js/clocks.js"></script>
<script src="js/neural.js"></script>
<script src="js/email.js"></script>
<script src="js/projects.js"></script>
<script src="js/voice.js"></script>
```

Replace with:
```html
<script src="js/clocks.js"></script>
<script src="js/neural.js"></script>
<script src="js/email.js"></script>
<script src="js/projects.js"></script>
<script src="js/voice.js"></script>
<script src="js/anthropic.js"></script>
```

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add Claude API widget HTML section to left panel"
```

---

### Task 5: Create `js/anthropic.js`

**Files:**
- Create: `js/anthropic.js`

- [ ] **Step 1: Create the file**

```javascript
(function () {
  const BACKEND = 'http://localhost:5050';

  // Haiku 4.5 pricing (matches backend calc)
  const INPUT_PRICE  = 0.25  / 1_000_000;
  const OUTPUT_PRICE = 1.25  / 1_000_000;

  // ── Build a full 365-day date→value lookup from API arrays ──
  function buildDayMap(data) {
    const map = {};
    if (!data.dates) return map;
    for (let i = 0; i < data.dates.length; i++) {
      map[data.dates[i]] = data.cost_usd[i] || 0;
    }
    return map;
  }

  // ── Generate the last 365 dates ending today, starting on Monday ──
  function buildDateGrid() {
    const today = new Date();
    // Walk back to the most recent Sunday (so grid ends with a full week col)
    const dayOfWeek = today.getDay(); // 0=Sun
    const end = new Date(today);
    end.setDate(end.getDate() + (dayOfWeek === 0 ? 0 : 7 - dayOfWeek));

    const start = new Date(end);
    start.setDate(start.getDate() - 52 * 7 - 6); // 53 weeks back

    const dates = [];
    const cur = new Date(start);
    while (cur <= end) {
      dates.push(cur.toISOString().slice(0, 10));
      cur.setDate(cur.getDate() + 1);
    }
    return dates; // length = 53*7 = 371, always starts on Monday
  }

  // ── Map cost value to intensity class ──
  function intensityClass(cost, maxCost) {
    if (!cost || maxCost === 0) return 'hm-0';
    const ratio = cost / maxCost;
    if (ratio < 0.15) return 'hm-1';
    if (ratio < 0.5)  return 'hm-2';
    return 'hm-3';
  }

  // ── Render the heatmap grid ──
  function renderHeatmap(data) {
    const grid = document.getElementById('claude-heatmap');
    const monthLabels = document.getElementById('claude-month-labels');
    if (!grid || !monthLabels) return;

    const dayMap  = buildDayMap(data);
    const dates   = buildDateGrid();
    const maxCost = Math.max(...Object.values(dayMap), 0.0001);

    grid.innerHTML = dates.map(d => {
      const cost = dayMap[d] || 0;
      const cls  = intensityClass(cost, maxCost);
      const tip  = `${d}: $${cost.toFixed(4)}`;
      return `<div class="heatmap-cell ${cls}" title="${tip}"></div>`;
    }).join('');

    // Month labels — place at the first column where month changes
    monthLabels.innerHTML = '';
    let lastMonth = '';
    for (let col = 0; col < 53; col++) {
      const dateIdx = col * 7; // Monday of this column
      if (dateIdx >= dates.length) break;
      const month = dates[dateIdx].slice(0, 7); // YYYY-MM
      if (month !== lastMonth) {
        lastMonth = month;
        const label = document.createElement('div');
        label.className = 'hm-month-label';
        label.style.left = (col * 9) + 'px'; // 7px cell + 2px gap
        label.textContent = new Date(dates[dateIdx] + 'T12:00:00').toLocaleString('en-US', { month: 'short' }).toUpperCase();
        monthLabels.appendChild(label);
      }
    }
  }

  // ── Render balance bar ──
  function renderBalance(totalSpend, creditUsd) {
    const amountEl = document.getElementById('claude-balance-amount');
    const barEl    = document.getElementById('claude-balance-bar');
    const ofEl     = document.getElementById('claude-balance-of');
    if (!amountEl || !barEl || !ofEl) return;

    if (!creditUsd) {
      amountEl.textContent = '$—';
      ofEl.textContent     = 'of $—';
      return;
    }

    const remaining = Math.max(0, creditUsd - totalSpend);
    const pct       = Math.min(100, (remaining / creditUsd) * 100);
    amountEl.textContent = `$${remaining.toFixed(2)}`;
    ofEl.textContent     = `of $${creditUsd.toFixed(2)}`;
    barEl.style.width    = pct + '%';
  }

  // ── Render stats row ──
  function renderStats(data) {
    const el = document.getElementById('claude-stats');
    if (!el) return;
    if (!data.dates || !data.dates.length) {
      el.textContent = 'INPUT — · OUTPUT — · EST. $—';
      return;
    }

    const now   = new Date();
    const month = now.toISOString().slice(0, 7); // YYYY-MM

    let totalIn = 0, totalOut = 0, totalCost = 0, totalAllCost = 0;
    for (let i = 0; i < data.dates.length; i++) {
      const cost = data.cost_usd[i] || 0;
      totalAllCost += cost;
      if (data.dates[i].startsWith(month)) {
        totalIn   += data.input_tokens[i]  || 0;
        totalOut  += data.output_tokens[i] || 0;
        totalCost += cost;
      }
    }

    function fmtTok(n) {
      if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
      if (n >= 1_000)     return (n / 1_000).toFixed(0) + 'K';
      return String(n);
    }

    el.textContent = `INPUT ${fmtTok(totalIn)} · OUTPUT ${fmtTok(totalOut)} · EST. $${totalCost.toFixed(2)} THIS MONTH`;
    return totalAllCost;
  }

  // ── Main fetch + render ──
  async function fetchAndRender() {
    try {
      const [usageRes, cfgRes] = await Promise.all([
        fetch(`${BACKEND}/anthropic-usage`, { signal: AbortSignal.timeout(5000) }),
        fetch(`${BACKEND}/config`,          { signal: AbortSignal.timeout(5000) }),
      ]);

      const data      = usageRes.ok ? await usageRes.json() : {};
      const cfg       = cfgRes.ok  ? await cfgRes.json()   : {};
      const creditUsd = cfg.anthropic_credit_usd || 0;

      renderHeatmap(data);
      const totalSpend = renderStats(data);
      renderBalance(totalSpend || 0, creditUsd);

      if (window.logEvent) window.logEvent('claude usage — refreshed');
    } catch (e) {
      // backend offline — leave display as-is
    }
  }

  fetchAndRender();
  setInterval(fetchAndRender, 3600_000);
})();
```

- [ ] **Step 2: Commit**

```bash
git add js/anthropic.js
git commit -m "feat: add anthropic.js heatmap, balance, and stats widget"
```

---

### Task 6: Smoke test in browser

- [ ] **Step 1: Restart the backend** (`start.bat` or `python server.py`) so the new `/anthropic-usage` and `/config` routes are live.

- [ ] **Step 2: Open `index.html` in browser** and confirm:
  - `// CLAUDE API` section appears above `// PROJECTS` in the left panel
  - Heatmap grid renders (cells visible, even if all `.hm-0` due to no usage)
  - Month labels appear below the grid
  - Balance row shows `$X.XX of $50.00`
  - Stats row shows `INPUT — · OUTPUT — · EST. $— THIS MONTH` (or real values if usage data returned)

- [ ] **Step 3: Hover a heatmap cell** — confirm tooltip shows `YYYY-MM-DD: $0.0000`

- [ ] **Step 4: Commit if any minor fixes were needed, then done.**
