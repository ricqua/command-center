(function() {
  const BACKEND = 'http://localhost:5050';

  function fmtSender(s) {
    return (s || '').replace(/"([^"]+)".*/, '$1').trim().toUpperCase().slice(0, 24);
  }

  function fmtSubject(s) {
    return (s || '(no subject)').slice(0, 34);
  }

  function pressureWidth(total) {
    return Math.min(Math.round((total / 200) * 100), 100);
  }

  function pressureColor(total) {
    if (total >= 100) return 'linear-gradient(90deg,#880022,var(--red))';
    if (total >= 50)  return 'linear-gradient(90deg,#aa6600,var(--amber))';
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
      setEl(`${prefix}-inbox`, '—');
      setEl(`${prefix}-today`, '—');
      setEl(`${prefix}-sent`, '—');
      setEl(`${prefix}-attach`, '—');
      setEl(`${prefix}-updated`, data ? '✗ ERROR' : '⚠ NO CONNECTION');
      return;
    }

    setEl(`${prefix}-inbox`,  data.inbox_total ?? '—');
    setEl(`${prefix}-today`,  data.today ?? '—');
    setEl(`${prefix}-sent`,   data.sent_today ?? '—');
    setEl(`${prefix}-attach`, data.attachments_7d ?? '—');
    setEl(`${prefix}-updated`, `UPDATED ${data.last_updated}`);

    const w = pressureWidth(data.inbox_total || 0);
    const c = pressureColor(data.inbox_total || 0);
    setStyle(`${prefix}-pressure`, 'width', w + '%');
    setStyle(`${prefix}-pressure`, 'background', c);

    const feed = document.getElementById(`${prefix}-recent`);
    if (feed && data.recent) {
      feed.innerHTML = '';
      data.recent.slice(0, 8).forEach(m => {
        const row = document.createElement('div');
        row.className = 'file-entry';
        row.style.cssText = 'flex-direction:column;align-items:flex-start;gap:1px;padding:3px 0;';
        const senderColor = m.unread ? 'var(--amber)' : 'var(--cyan-dim)';
        const senderEl = document.createElement('span');
        senderEl.textContent = fmtSender(m.sender);
        senderEl.style.cssText = `color:${senderColor};font-size:8px;letter-spacing:1px;`;
        const subjectEl = document.createElement('span');
        subjectEl.textContent = fmtSubject(m.subject);
        subjectEl.style.cssText = 'font-size:9px;color:var(--text);';
        row.append(senderEl, subjectEl);
        feed.appendChild(row);
      });
    }

  }

  function setStatus(online) {
    const dot  = document.getElementById('status-dot');
    const text = document.getElementById('status-text');
    if (!dot || !text) return;
    if (online) {
      dot.classList.remove('offline');
      text.classList.remove('offline');
      text.textContent = 'ALL SYSTEMS NOMINAL';
    } else {
      dot.classList.add('offline');
      text.classList.add('offline');
      text.textContent = 'BACKEND OFFLINE';
    }
  }

  async function fetchEmailMetrics() {
    try {
      const res  = await fetch(`${BACKEND}/metrics`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      renderEmailPanel('workspace', data.workspace);
      setStatus(true);
      if (window.logEvent) window.logEvent(`email poll — workspace ${data.workspace?.inbox_total ?? '?'} in inbox`);
    } catch {
      renderEmailPanel('workspace', null);
      setStatus(false);
    }
  }

  fetchEmailMetrics();
  setInterval(fetchEmailMetrics, 120000);
})();
