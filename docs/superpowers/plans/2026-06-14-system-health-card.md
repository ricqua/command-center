# System Health Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `// SYSTEM HEALTH` card below `// HYDRATION` in the right panel showing real-time CPU %, RAM %, disk %, and network I/O sourced from a new `/syshealth` backend endpoint.

**Architecture:** `psutil` runs in a background thread in `server.py`, sampling CPU/RAM/disk/network every 5 seconds into a cache dict. A new `/syshealth` GET endpoint serves that cache. A new `js/syshealth.js` polls the endpoint every 5 seconds and updates a card added to `index.html`. No new files touch existing modules — this is purely additive.

**Tech Stack:** Python `psutil` (backend), vanilla JS `fetch` (frontend), existing CSS `kpi-card` pattern.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `backend/requirements.txt` | Modify | Add `psutil>=5.9.0` |
| `backend/server.py` | Modify | Add syshealth cache + background sampler + `/syshealth` GET route |
| `index.html` | Modify | Add `// SYSTEM HEALTH` card HTML in right panel, add `<script>` tag |
| `style.css` | Modify | Add `.sh-grid` layout (2×2), `.sh-net` network row style |
| `js/syshealth.js` | Create | Poll `/syshealth`, update DOM, color-code bars |

---

## Task 1: Add `psutil` dependency

**Files:**
- Modify: `backend/requirements.txt`

- [ ] **Step 1: Add psutil to requirements.txt**

Open `backend/requirements.txt` and add one line so it reads:

```
google-auth>=2.0.0
google-auth-oauthlib>=1.0.0
google-auth-httplib2>=0.1.0
google-api-python-client>=2.0.0
anthropic>=0.25.0
requests>=2.31.0
psutil>=5.9.0
```

- [ ] **Step 2: Install it**

```bash
pip install psutil>=5.9.0
```

Expected: `Successfully installed psutil-X.Y.Z` (or "already satisfied").

- [ ] **Step 3: Verify import works**

```bash
python3 -c "import psutil; print(psutil.cpu_percent(interval=1)); print(psutil.virtual_memory().percent)"
```

Expected: two numbers printed, e.g. `12.5` and `41.3`. No ImportError.

- [ ] **Step 4: Commit**

```bash
git add backend/requirements.txt
git commit -m "chore: add psutil dependency for system health metrics"
```

---

## Task 2: Add `/syshealth` endpoint to `backend/server.py`

**Files:**
- Modify: `backend/server.py`

This task adds three things to `server.py`:
1. A `syshealth_cache` dict + lock (same pattern as `anthropic_usage_cache`)
2. A `sample_syshealth()` function + `syshealth_loop()` background thread
3. A `/syshealth` route in `do_GET`

- [ ] **Step 1: Add cache globals**

After the `anthropic_usage_cache` and `anthropic_usage_lock` lines (around line 66–67), add:

```python
# ── SYSTEM HEALTH CACHE ──────────────────────────────────────────────────────

syshealth_cache = {}
syshealth_lock  = threading.Lock()
```

- [ ] **Step 2: Add sampler function and loop**

After the `usage_loop()` function (around line 241), add:

```python
# ── SYSTEM HEALTH SAMPLER ────────────────────────────────────────────────────

def sample_syshealth():
    try:
        import psutil
        # First call establishes baseline; interval=1 blocks 1 second for accurate CPU
        cpu  = psutil.cpu_percent(interval=1)
        ram  = psutil.virtual_memory().percent
        disk = psutil.disk_usage('/').percent

        # Network delta over 1 second
        net1 = psutil.net_io_counters()
        time.sleep(1)
        net2 = psutil.net_io_counters()
        net_sent = max(net2.bytes_sent - net1.bytes_sent, 0)
        net_recv = max(net2.bytes_recv - net1.bytes_recv, 0)

        return {
            'cpu':      round(cpu, 1),
            'ram':      round(ram, 1),
            'disk':     round(disk, 1),
            'net_sent': net_sent,
            'net_recv': net_recv,
            'status':   'ok',
        }
    except Exception as e:
        log(f"syshealth — error — {e}")
        return {'status': 'error', 'error': str(e)}


def syshealth_loop():
    while True:
        result = sample_syshealth()
        with syshealth_lock:
            syshealth_cache.clear()
            syshealth_cache.update(result)
        time.sleep(3)  # sleep 3s; the sample itself takes ~2s (two 1s sleeps)
```

- [ ] **Step 3: Add `/syshealth` route in `do_GET`**

Inside `do_GET`, after the `elif self.path == '/anthropic-usage':` block (around line 369–371), add:

```python
        elif self.path == '/syshealth':
            with syshealth_lock:
                self.send_json(dict(syshealth_cache))
```

- [ ] **Step 4: Start the syshealth background thread in `__main__`**

In the `if __name__ == '__main__':` block, after the line `threading.Thread(target=usage_loop, daemon=True).start()` (around line 469), add:

```python
    threading.Thread(target=syshealth_loop, daemon=True).start()
```

- [ ] **Step 5: Test the endpoint manually**

Start the backend:
```bash
cd /mnt/c/Users/ricqua/Desktop/Projects/command-center/backend
python3 server.py
```

In a second terminal:
```bash
curl http://localhost:5050/syshealth
```

Expected (values will vary):
```json
{"cpu": 14.2, "ram": 55.8, "disk": 28.4, "net_sent": 1024, "net_recv": 8192, "status": "ok"}
```

All five numeric fields must be present and non-null. `status` must be `"ok"`.

- [ ] **Step 6: Commit**

```bash
git add backend/server.py
git commit -m "feat: add /syshealth endpoint with psutil CPU/RAM/disk/network metrics"
```

---

## Task 3: Add system health card HTML to `index.html`

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add the card HTML**

In `index.html`, locate the hydration section in the right panel. It ends with:
```html
      <div class="hydration-status" id="hyd-status">—</div>
    </div>
  </div>
```

After the closing `</div>` of the hydration `kpi-card` (the one with `id="hyd-status"`) and before the closing `</div>` of `panel-right`, insert:

```html
    <!-- System Health -->
    <div class="panel-label">// SYSTEM HEALTH</div>
    <div class="kpi-card" style="--delay:0.8s; padding:8px 11px;">
      <div class="corner corner-tl"></div><div class="corner corner-br"></div>
      <div class="sh-grid">
        <div>
          <div class="kpi-label">CPU USAGE</div>
          <div class="sh-value" id="sh-cpu">—</div>
          <div class="bk-bar" style="margin-top:4px;"><div class="bk-bar-fill sh-bar" id="sh-cpu-bar" style="width:0%"></div></div>
        </div>
        <div>
          <div class="kpi-label">RAM USAGE</div>
          <div class="sh-value" id="sh-ram">—</div>
          <div class="bk-bar" style="margin-top:4px;"><div class="bk-bar-fill sh-bar" id="sh-ram-bar" style="width:0%"></div></div>
        </div>
        <div>
          <div class="kpi-label">DISK USAGE</div>
          <div class="sh-value" id="sh-disk">—</div>
          <div class="bk-bar" style="margin-top:4px;"><div class="bk-bar-fill sh-bar" id="sh-disk-bar" style="width:0%"></div></div>
        </div>
        <div>
          <div class="kpi-label">NETWORK</div>
          <div class="sh-net" id="sh-net-sent">↑ —</div>
          <div class="sh-net" id="sh-net-recv">↓ —</div>
        </div>
      </div>
      <div id="sh-updated" style="font-size:7px;color:var(--text-muted);letter-spacing:2px;margin-top:6px;">⚠ START BACKEND</div>
    </div>
```

- [ ] **Step 2: Add `syshealth.js` script tag**

At the bottom of `index.html`, after `<script src="js/hydration.js"></script>`, add:

```html
<script src="js/syshealth.js"></script>
```

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add system health card HTML to right panel"
```

---

## Task 4: Add system health CSS to `style.css`

**Files:**
- Modify: `style.css`

- [ ] **Step 1: Add `.sh-grid`, `.sh-value`, `.sh-net` styles**

At the end of `style.css`, append:

```css
/* ── SYSTEM HEALTH CARD ── */
.sh-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 10px;
  margin-bottom: 2px;
}

.sh-value {
  font-size: 16px;
  color: var(--cyan);
  text-shadow: 0 0 10px var(--cyan);
  letter-spacing: 1px;
  line-height: 1.2;
  transition: color 0.4s, text-shadow 0.4s;
}

.sh-value.warn  { color: var(--amber); text-shadow: 0 0 10px var(--amber); }
.sh-value.crit  { color: var(--red);   text-shadow: 0 0 10px var(--red);   }

.sh-bar { transition: width 1s ease, background 0.4s; }
.sh-bar.warn { background: linear-gradient(90deg, #aa6600, var(--amber)); }
.sh-bar.crit { background: linear-gradient(90deg, #880022, var(--red));   }

.sh-net {
  font-size: 9px;
  color: var(--text-dim);
  letter-spacing: 1px;
  line-height: 1.6;
}
```

- [ ] **Step 2: Commit**

```bash
git add style.css
git commit -m "feat: add system health card CSS styles"
```

---

## Task 5: Create `js/syshealth.js`

**Files:**
- Create: `js/syshealth.js`

- [ ] **Step 1: Create the file**

Create `/mnt/c/Users/ricqua/Desktop/Projects/command-center/js/syshealth.js` with:

```javascript
(function () {
  const BACKEND = 'http://localhost:5050';

  function fmtBytes(bytes) {
    if (bytes >= 1_000_000) return (bytes / 1_000_000).toFixed(1) + ' MB/s';
    if (bytes >= 1_000)     return (bytes / 1_000).toFixed(0) + ' KB/s';
    return bytes + ' B/s';
  }

  function applyLevel(valueId, barId, pct) {
    const valEl = document.getElementById(valueId);
    const barEl = document.getElementById(barId);
    if (!valEl || !barEl) return;

    valEl.textContent = pct.toFixed(1) + '%';
    barEl.style.width = pct + '%';

    if (pct >= 85) {
      valEl.className = 'sh-value crit';
      barEl.className = 'bk-bar-fill sh-bar crit';
    } else if (pct >= 60) {
      valEl.className = 'sh-value warn';
      barEl.className = 'bk-bar-fill sh-bar warn';
    } else {
      valEl.className = 'sh-value';
      barEl.className = 'bk-bar-fill sh-bar';
    }
  }

  function render(data) {
    if (!data || data.status === 'error') {
      ['sh-cpu', 'sh-ram', 'sh-disk'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.textContent = '—'; el.className = 'sh-value'; }
      });
      ['sh-cpu-bar', 'sh-ram-bar', 'sh-disk-bar'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.width = '0%';
      });
      const sent = document.getElementById('sh-net-sent');
      const recv = document.getElementById('sh-net-recv');
      if (sent) sent.textContent = '↑ —';
      if (recv) recv.textContent = '↓ —';
      const upd = document.getElementById('sh-updated');
      if (upd) upd.textContent = data ? '✗ ERROR' : '⚠ START BACKEND';
      return;
    }

    applyLevel('sh-cpu',  'sh-cpu-bar',  data.cpu);
    applyLevel('sh-ram',  'sh-ram-bar',  data.ram);
    applyLevel('sh-disk', 'sh-disk-bar', data.disk);

    const sent = document.getElementById('sh-net-sent');
    const recv = document.getElementById('sh-net-recv');
    if (sent) sent.textContent = '↑ ' + fmtBytes(data.net_sent);
    if (recv) recv.textContent = '↓ ' + fmtBytes(data.net_recv);

    const upd = document.getElementById('sh-updated');
    if (upd) upd.textContent = 'UPDATED ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    if (window.logEvent) window.logEvent(`syshealth — cpu ${data.cpu}% ram ${data.ram}% disk ${data.disk}%`);
  }

  async function fetchSyshealth() {
    try {
      const res  = await fetch(`${BACKEND}/syshealth`, { signal: AbortSignal.timeout(4000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      render(data);
    } catch {
      render(null);
    }
  }

  fetchSyshealth();
  setInterval(fetchSyshealth, 5000);
})();
```

- [ ] **Step 2: Verify the card renders**

Open the dashboard in Chrome (with backend running). Expected:
- `// SYSTEM HEALTH` card appears below `// HYDRATION` in the right panel
- CPU, RAM, disk show percentages with colored bars (green by default, amber if >60%, red if >85%)
- Network shows `↑ X KB/s` and `↓ Y KB/s`
- Timestamp updates every 5 seconds

- [ ] **Step 3: Commit**

```bash
git add js/syshealth.js
git commit -m "feat: add syshealth.js frontend — polls /syshealth and renders health card"
```

---

## Self-Review

**Spec coverage:**
- ✅ CPU % — `sh-cpu` + `sh-cpu-bar` in Task 5 via `data.cpu`
- ✅ RAM % — `sh-ram` + `sh-ram-bar` in Task 5 via `data.ram`
- ✅ Disk % — `sh-disk` + `sh-disk-bar` in Task 5 via `data.disk`
- ✅ Network I/O (sent + recv bytes/sec) — `sh-net-sent` / `sh-net-recv` in Task 5
- ✅ Color coding green/amber/red — `.sh-value.warn`, `.sh-value.crit` in Task 4; logic in Task 5 `applyLevel()`
- ✅ Backend `/syshealth` endpoint — Task 2
- ✅ `psutil` dependency — Task 1
- ✅ Card placed below Hydration in right panel — Task 3
- ✅ Polls every 5 seconds — `setInterval(fetchSyshealth, 5000)` in Task 5
- ✅ Error/offline state — `render(null)` path in Task 5 shows `⚠ START BACKEND`

**Placeholder scan:** No TBDs, no TODOs, no vague steps — all steps include exact code.

**Type consistency:** `data.cpu`, `data.ram`, `data.disk`, `data.net_sent`, `data.net_recv`, `data.status` defined in Task 2 `sample_syshealth()` and consumed identically in Task 5 `render()`. Element IDs `sh-cpu`, `sh-ram`, `sh-disk`, `sh-cpu-bar`, `sh-ram-bar`, `sh-disk-bar`, `sh-net-sent`, `sh-net-recv`, `sh-updated` defined in Task 3 HTML and targeted in Task 5 JS. CSS classes `sh-value`, `sh-value.warn`, `sh-value.crit`, `sh-bar`, `sh-bar.warn`, `sh-bar.crit` defined in Task 4 and set in Task 5 `applyLevel()`.
