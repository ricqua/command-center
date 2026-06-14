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
