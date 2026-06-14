(function() {
  const BACKEND = 'http://localhost:5050';
  let projectsData = [];
  let focusIndex   = 0;

  // ── HTML escape helper (XSS prevention) ──
  function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

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
        <div class="session-title">${esc(p.name.toUpperCase())}</div>
        <div class="session-meta">${esc(fmtDate(p.last_modified))}</div>
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
      `<div class="log-entry"><span class="log-time">${esc(e.time)}</span>${esc(e.message)}</div>`
    ).join('');
  }

  async function fetchBackendLog() {
    try {
      const res  = await fetch(`${BACKEND}/log`, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
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
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
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
