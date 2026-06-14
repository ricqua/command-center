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
