(function () {
  const GOAL         = 14;
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
    const now     = new Date();
    const hour    = now.getHours() + now.getMinutes() / 60;
    const clamped = Math.min(Math.max(hour, OFFICE_START), OFFICE_END);
    const elapsed = clamped - OFFICE_START;
    return Math.floor((elapsed / (OFFICE_END - OFFICE_START)) * GOAL);
  }

  function isOfficeHours() {
    const now  = new Date();
    const hour = now.getHours() + now.getMinutes() / 60;
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

    fillEl.style.width  = fillPct + '%';
    markerEl.style.left = markerPct + '%';
    countEl.textContent = `${count} / ${GOAL}`;

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
  let count        = load();
  let resetPending = false;
  let resetTimer   = null;

  // ── Drink button ──
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
      postHydration(0);
      if (window.logEvent) window.logEvent('hydration — reset');
    }
  });

  // ── Init + 60s interval ──
  render(count);
  setInterval(() => render(count), 60000);
})();
