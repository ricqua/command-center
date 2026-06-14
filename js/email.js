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
