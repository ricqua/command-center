(function () {
  const canvas = document.getElementById('plasma-canvas');
  const ctx    = canvas.getContext('2d');

  // ── Resize ──
  function resize() {
    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  // ── State ──
  const STATES = {
    idle: {
      hues:   [185, 210, 255, 170, 230, 275],
      speed:  1.0,
      radius: 120,
    },
    listening: {
      hues:   [0, 345, 310, 355, 330, 15],
      speed:  3.0,
      radius: 150,
    },
    speaking: {
      hues:   [140, 165, 100, 155, 175, 80],
      speed:  2.0,
      radius: 120,
    },
  };

  let currentState   = 'idle';
  let targetHues     = [...STATES.idle.hues];
  let currentHues    = [...STATES.idle.hues];
  let targetSpeed    = STATES.idle.speed;
  let currentSpeed   = STATES.idle.speed;
  let targetRadius   = STATES.idle.radius;
  let amplitude      = 0;

  // ── Blobs ──
  const blobs = [
    { x: 0.3, y: 0.4, vx:  0.0008, vy:  0.0006, freqX: 0.011, freqY: 0.009,  phase: 0.0  },
    { x: 0.7, y: 0.3, vx: -0.0007, vy:  0.0009, freqX: 0.007, freqY: 0.013,  phase: 1.1  },
    { x: 0.5, y: 0.7, vx:  0.0009, vy: -0.0007, freqX: 0.013, freqY: 0.008,  phase: 2.2  },
    { x: 0.2, y: 0.6, vx: -0.0006, vy: -0.0008, freqX: 0.009, freqY: 0.011,  phase: 3.3  },
    { x: 0.8, y: 0.6, vx:  0.0007, vy:  0.0007, freqX: 0.012, freqY: 0.007,  phase: 4.4  },
    { x: 0.5, y: 0.2, vx: -0.0008, vy:  0.0006, freqX: 0.008, freqY: 0.012,  phase: 5.5  },
  ];

  let tick = 0;

  // ── Lerp helper ──
  function lerp(a, b, t) { return a + (b - a) * t; }

  // ── Render ──
  function draw() {
    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#02030a';
    ctx.fillRect(0, 0, W, H);

    // Interpolate speed
    currentSpeed = lerp(currentSpeed, targetSpeed, 0.04);

    // Interpolate hues
    for (let i = 0; i < 6; i++) {
      currentHues[i] = lerp(currentHues[i], targetHues[i], 0.03);
    }

    // Blob radius: base + amplitude boost during speaking
    const baseRadius = currentState === 'speaking'
      ? targetRadius + amplitude * 60
      : targetRadius;

    // Draw blobs
    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    blobs.forEach((b, i) => {
      // Update position
      b.x += (b.vx + Math.sin(tick * b.freqX + b.phase) * 0.0012) * currentSpeed;
      b.y += (b.vy + Math.cos(tick * b.freqY + b.phase) * 0.0012) * currentSpeed;

      // Wrap edges
      if (b.x < -0.1) b.x = 1.1;
      if (b.x >  1.1) b.x = -0.1;
      if (b.y < -0.1) b.y = 1.1;
      if (b.y >  1.1) b.y = -0.1;

      const px = b.x * W;
      const py = b.y * H;
      const r  = baseRadius * (W / 600); // scale with panel width
      const hue = currentHues[i];

      const grad = ctx.createRadialGradient(px, py, 0, px, py, r * 1.5);
      grad.addColorStop(0,   `hsla(${hue}, 100%, 65%, 0.55)`);
      grad.addColorStop(0.4, `hsla(${hue}, 90%,  50%, 0.25)`);
      grad.addColorStop(1,   `hsla(${hue}, 80%,  40%, 0)`);

      ctx.beginPath();
      ctx.arc(px, py, r * 1.5, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    });

    ctx.restore();

    // Vignette — darken edges, let center shine
    const vignette = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.6);
    vignette.addColorStop(0,    'rgba(2,3,10,0)');
    vignette.addColorStop(0.45, 'rgba(2,3,10,0.15)');
    vignette.addColorStop(1,    'rgba(2,3,10,0.88)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);

    tick++;
    requestAnimationFrame(draw);
  }

  draw();

  // ── Public API ──
  window.plasmaSetState = function (state) {
    if (!STATES[state]) return;
    currentState  = state;
    targetHues    = [...STATES[state].hues];
    targetSpeed   = STATES[state].speed;
    targetRadius  = STATES[state].radius;
  };

  window.plasmaSetAmplitude = function (value) {
    amplitude = Math.max(0, Math.min(1, value));
  };
})();
