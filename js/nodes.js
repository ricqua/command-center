(function () {
  const canvas = document.getElementById('nodes-canvas');
  const ctx = canvas.getContext('2d');

  const NODE_COUNT   = 38;
  const EDGE_DIST    = 110;
  const REPEL_R      = 120;
  const REPEL_F      = 0.5;
  const ATTRACT_R    = 240;
  const ATTRACT_F    = 0.015;

  let W, H, nodes = [], edges = [];
  let mouse = { x: -9999, y: -9999, active: false };

  function resize() {
    W = canvas.width  = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
    initNodes();
  }

  function initNodes() {
    const cx = W / 2, cy = H / 2;
    nodes = Array.from({ length: NODE_COUNT }, (_, i) => {
      const angle = (i / NODE_COUNT) * Math.PI * 2 + Math.random() * 0.5;
      const r     = 80 + Math.random() * Math.min(W, H) * 0.32;
      return {
        x:          cx + Math.cos(angle) * r,
        y:          cy + Math.sin(angle) * r,
        vx:         (Math.random() - 0.5) * 0.2,
        vy:         (Math.random() - 0.5) * 0.2,
        radius:     1.4 + Math.random() * 2,
        brightness: 0.35 + Math.random() * 0.55,
        phase:      Math.random() * Math.PI * 2,
        phaseSpd:   0.018 + Math.random() * 0.025,
      };
    });
    buildEdges();
  }

  function buildEdges() {
    edges = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const d  = Math.sqrt(dx * dx + dy * dy);
        if (d < EDGE_DIST) edges.push({ a: i, b: j, d });
      }
    }
  }

  canvas.addEventListener('mousemove', e => {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
    mouse.active = true;
  });

  canvas.addEventListener('mouseleave', () => {
    mouse.active = false;
    mouse.x = -9999;
    mouse.y = -9999;
  });

  function draw() {
    ctx.clearRect(0, 0, W, H);

    const cx = W / 2, cy = H / 2;

    nodes.forEach(n => {
      n.x += n.vx;
      n.y += n.vy;

      // Soft center pull
      const dcx = n.x - cx, dcy = n.y - cy;
      const dc  = Math.sqrt(dcx * dcx + dcy * dcy);
      if (dc > Math.min(W, H) * 0.42) {
        n.vx -= dcx * 0.00015;
        n.vy -= dcy * 0.00015;
      }

      // Mouse repel / attract
      const dmx = n.x - mouse.x, dmy = n.y - mouse.y;
      const dm  = Math.sqrt(dmx * dmx + dmy * dmy);
      if (dm < REPEL_R && dm > 0) {
        const f = (1 - dm / REPEL_R) * REPEL_F;
        n.vx += (dmx / dm) * f;
        n.vy += (dmy / dm) * f;
      } else if (dm < ATTRACT_R && dm > REPEL_R) {
        const f = (1 - (dm - REPEL_R) / (ATTRACT_R - REPEL_R)) * ATTRACT_F;
        n.vx -= (dmx / dm) * f;
        n.vy -= (dmy / dm) * f;
      }

      n.vx *= 0.975;
      n.vy *= 0.975;

      // Edge bounce
      if (n.x < 8 || n.x > W - 8) n.vx *= -0.7;
      if (n.y < 8 || n.y > H - 8) n.vy *= -0.7;
      n.x = Math.max(8, Math.min(W - 8, n.x));
      n.y = Math.max(8, Math.min(H - 8, n.y));

      n.phase += n.phaseSpd;
    });

    // Rebuild edges periodically
    if (Math.random() < 0.004) buildEdges();

    // Mouse ripple
    if (mouse.active) {
      const ripple = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, REPEL_R);
      ripple.addColorStop(0,   'rgba(0,245,255,0.07)');
      ripple.addColorStop(0.5, 'rgba(0,128,255,0.03)');
      ripple.addColorStop(1,   'transparent');
      ctx.fillStyle = ripple;
      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, REPEL_R, 0, Math.PI * 2);
      ctx.fill();

      // Cursor dot
      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,245,255,0.65)';
      ctx.fill();
    }

    // Edges
    edges.forEach(e => {
      const a = nodes[e.a], b = nodes[e.b];
      const alpha = (1 - e.d / EDGE_DIST) * 0.14;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = `rgba(0,200,230,${alpha})`;
      ctx.lineWidth = 0.6;
      ctx.stroke();
    });

    // Lines from nodes near mouse to cursor
    if (mouse.active) {
      nodes.forEach(n => {
        const dx = n.x - mouse.x, dy = n.y - mouse.y;
        const d  = Math.sqrt(dx * dx + dy * dy);
        if (d < REPEL_R * 1.3) {
          const alpha = (1 - d / (REPEL_R * 1.3)) * 0.3;
          ctx.beginPath();
          ctx.moveTo(n.x, n.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.strokeStyle = `rgba(0,245,255,${alpha})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      });
    }

    // Nodes
    nodes.forEach(n => {
      const dmx = n.x - mouse.x, dmy = n.y - mouse.y;
      const dm  = Math.sqrt(dmx * dmx + dmy * dmy);
      const near = mouse.active && dm < REPEL_R;

      const glow  = 0.5 + 0.5 * Math.sin(n.phase);
      const alpha = n.brightness * (near ? 1 : 0.45 + glow * 0.45);
      const color = near ? '255,190,30' : '0,235,255';
      const r     = near ? n.radius * 1.7 : n.radius;

      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${color},${alpha})`;
      ctx.fill();

      if (near || n.radius > 2.8) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, r * 2.8, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${color},${alpha * 0.08})`;
        ctx.fill();
      }
    });

    requestAnimationFrame(draw);
  }

  resize();
  window.addEventListener('resize', resize);
  requestAnimationFrame(draw);
})();
