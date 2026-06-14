(function() {
  const canvas = document.getElementById('neural-canvas');
  const ctx = canvas.getContext('2d');

  let W, H, nodes = [], edges = [], particles = [];
  const NODE_COUNT = 55;
  const EDGE_DIST = 130;

  let mouse = { x: -9999, y: -9999, active: false };
  const REPEL_RADIUS = 140;
  const REPEL_FORCE  = 0.55;
  const ATTRACT_RADIUS = 260;
  const ATTRACT_FORCE  = 0.018;

  canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
    mouse.active = true;
  });
  canvas.addEventListener('mouseleave', () => { mouse.active = false; mouse.x = -9999; mouse.y = -9999; });

  canvas.addEventListener('click', e => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    nodes.forEach(n => {
      const dx = n.x - mx, dy = n.y - my;
      const d = Math.sqrt(dx*dx + dy*dy);
      if (d < 200 && d > 0) {
        const f = (1 - d / 200) * 4;
        n.vx += (dx / d) * f;
        n.vy += (dy / d) * f;
      }
    });
    for (let i = 0; i < 8; i++) spawnParticle();
  });

  function resize() {
    W = canvas.width = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
    initNodes();
  }

  function initNodes() {
    nodes = [];
    const cx = W / 2, cy = H / 2;
    for (let i = 0; i < NODE_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() < 0.35
        ? Math.random() * 80
        : 80 + Math.random() * Math.min(W, H) * 0.35;
      nodes.push({
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        r: 1.5 + Math.random() * 2.5,
        brightness: 0.4 + Math.random() * 0.6,
        pulse: Math.random() * Math.PI * 2,
        pulseSpeed: 0.02 + Math.random() * 0.03,
      });
    }
    buildEdges();
  }

  function buildEdges() {
    edges = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const d = Math.sqrt(dx*dx + dy*dy);
        if (d < EDGE_DIST) edges.push({ a: i, b: j, d });
      }
    }
    const nodeCountEl = document.getElementById('node-count');
    const nodeBarEl = document.getElementById('node-bar');
    if (nodeCountEl) nodeCountEl.textContent = nodes.length;
    if (nodeBarEl) nodeBarEl.style.width = Math.min(nodes.length / NODE_COUNT * 100, 100) + '%';
  }

  function spawnParticle() {
    if (edges.length === 0) return;
    const e = edges[Math.floor(Math.random() * edges.length)];
    const forward = Math.random() > 0.5;
    particles.push({
      edgeIdx: edges.indexOf(e),
      t: forward ? 0 : 1,
      speed: (forward ? 1 : -1) * (0.003 + Math.random() * 0.005),
      color: Math.random() > 0.7 ? '#0080ff' : '#00f5ff',
    });
  }

  let lastParticle = 0;
  function animate(ts) {
    ctx.clearRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2;

    nodes.forEach(n => {
      n.x += n.vx; n.y += n.vy;
      const dcx = n.x - cx, dcy = n.y - cy;
      const dcDist = Math.sqrt(dcx*dcx + dcy*dcy);
      if (dcDist > Math.min(W, H) * 0.45) {
        n.vx -= dcx * 0.0002;
        n.vy -= dcy * 0.0002;
      }
      const dmx = n.x - mouse.x, dmy = n.y - mouse.y;
      const dm = Math.sqrt(dmx*dmx + dmy*dmy);
      if (dm < REPEL_RADIUS && dm > 0) {
        const f = (1 - dm / REPEL_RADIUS) * REPEL_FORCE;
        n.vx += (dmx / dm) * f;
        n.vy += (dmy / dm) * f;
      } else if (dm < ATTRACT_RADIUS && dm > REPEL_RADIUS) {
        const f = (1 - (dm - REPEL_RADIUS) / (ATTRACT_RADIUS - REPEL_RADIUS)) * ATTRACT_FORCE;
        n.vx -= (dmx / dm) * f;
        n.vy -= (dmy / dm) * f;
      }
      n.vx *= 0.97; n.vy *= 0.97;
      if (n.x < 10 || n.x > W - 10) n.vx *= -0.8;
      if (n.y < 10 || n.y > H - 10) n.vy *= -0.8;
      n.x = Math.max(10, Math.min(W - 10, n.x));
      n.y = Math.max(10, Math.min(H - 10, n.y));
      n.pulse += n.pulseSpeed;
    });

    if (Math.random() < 0.005) buildEdges();

    if (mouse.active) {
      const ripple = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, REPEL_RADIUS);
      ripple.addColorStop(0, 'rgba(0,245,255,0.06)');
      ripple.addColorStop(0.5, 'rgba(0,128,255,0.03)');
      ripple.addColorStop(1, 'transparent');
      ctx.fillStyle = ripple;
      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, REPEL_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,245,255,0.6)';
      ctx.fill();

      nodes.forEach(n => {
        const dx = n.x - mouse.x, dy = n.y - mouse.y;
        const d = Math.sqrt(dx*dx + dy*dy);
        if (d < REPEL_RADIUS * 1.2) {
          const alpha = (1 - d / (REPEL_RADIUS * 1.2)) * 0.35;
          ctx.beginPath();
          ctx.moveTo(n.x, n.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.strokeStyle = `rgba(0,245,255,${alpha})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      });
    }

    edges.forEach(e => {
      const a = nodes[e.a], b = nodes[e.b];
      const alpha = (1 - e.d / EDGE_DIST) * 0.18;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = `rgba(0,180,220,${alpha})`;
      ctx.lineWidth = 0.5;
      ctx.stroke();
    });

    nodes.forEach(n => {
      const dmx = n.x - mouse.x, dmy = n.y - mouse.y;
      const dm = Math.sqrt(dmx*dmx + dmy*dmy);
      const nearMouse = mouse.active && dm < REPEL_RADIUS;
      const glow = 0.5 + 0.5 * Math.sin(n.pulse);
      const alpha = n.brightness * (nearMouse ? 1 : (0.5 + glow * 0.5));
      const nodeColor = nearMouse ? '255,180,0' : '0,245,255';
      ctx.beginPath();
      ctx.arc(n.x, n.y, nearMouse ? n.r * 1.6 : n.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${nodeColor},${alpha})`;
      ctx.fill();
      if (n.r > 3 || nearMouse) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, (nearMouse ? n.r * 1.6 : n.r) * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${nodeColor},${alpha * 0.1})`;
        ctx.fill();
      }
    });

    const spawnRate = mouse.active ? 60 : 120;
    if (ts - lastParticle > spawnRate && particles.length < 60) {
      spawnParticle();
      lastParticle = ts;
    }

    particles = particles.filter(p => {
      const e = edges[p.edgeIdx];
      if (!e) return false;
      p.t += p.speed;
      if (p.t < 0 || p.t > 1) return false;
      const a = nodes[e.a], b = nodes[e.b];
      const x = a.x + (b.x - a.x) * p.t;
      const y = a.y + (b.y - a.y) * p.t;
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = p.color === '#00f5ff' ? 'rgba(0,245,255,0.2)' : 'rgba(0,128,255,0.2)';
      ctx.fill();
      return true;
    });

    const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, 90);
    grd.addColorStop(0, 'rgba(0,245,255,0.04)');
    grd.addColorStop(1, 'transparent');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);

    requestAnimationFrame(animate);
  }

  resize();
  window.addEventListener('resize', resize);
  requestAnimationFrame(animate);
})();
