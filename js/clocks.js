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
  }

  updateClocks();
  setInterval(updateClocks, 1000);
})();
