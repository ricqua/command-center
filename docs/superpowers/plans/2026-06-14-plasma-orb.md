# Plasma Orb Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the neural network canvas with a living plasma orb that fills the center panel, concentrates brightness at the ring center, and dramatically shifts color/speed with voice state.

**Architecture:** A single `js/plasma.js` IIFE owns all canvas rendering via `requestAnimationFrame`. It exposes `window.plasmaSetState(state)` and `window.plasmaSetAmplitude(value)` for `voice.js` to call at state transitions. The neural canvas and `neural.js` are removed entirely. Two extra orbit ring divs are added to `index.html` for depth.

**Tech Stack:** Vanilla JS Canvas 2D API, CSS custom properties, Web Audio API (AnalyserNode) for amplitude in `voice.js`.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `js/plasma.js` | Create | Canvas setup, blob model, render loop, vignette, state transitions, amplitude API |
| `js/neural.js` | Delete | Replaced by plasma.js |
| `js/voice.js` | Modify | Add `plasmaSetState()` calls at state transitions; add Web Audio analyser + amplitude feed during speaking |
| `index.html` | Modify | Replace `neural-canvas` → `plasma-canvas`; swap script tags; add `.orbit-3` `.orbit-4` divs inside `.ai-ring` |
| `style.css` | Modify | Replace `#neural-canvas` rule with `#plasma-canvas`; add `.orbit-3`, `.orbit-4` styles; add ring color transition |

---

### Task 1: Replace canvas in HTML and CSS

**Files:**
- Modify: `/mnt/c/Users/ricqua/Desktop/Projects/command-center/index.html`
- Modify: `/mnt/c/Users/ricqua/Desktop/Projects/command-center/style.css`

**Context:** `index.html` line 89 has `<canvas id="neural-canvas">`. Lines 91–98 have `.ai-ring` with the mic button inside. Lines 179 has `<script src="js/neural.js">`. `style.css` around line 301 has `#neural-canvas { position: absolute; inset: 0; width: 100%; height: 100%; }`.

- [ ] **Step 1: Replace neural-canvas with plasma-canvas in index.html**

In `index.html`, replace:
```html
    <canvas id="neural-canvas"></canvas>
    <div class="center-overlay">
      <div class="ai-ring">
        <button class="mic-btn" id="mic-btn" title="Click to speak to Nightfall">
```

With:
```html
    <canvas id="plasma-canvas"></canvas>
    <div class="center-overlay">
      <div class="ai-ring">
        <div class="orbit orbit-3"></div>
        <div class="orbit orbit-4"></div>
        <button class="mic-btn" id="mic-btn" title="Click to speak to Nightfall">
```

- [ ] **Step 2: Swap script tags in index.html**

Replace:
```html
<script src="js/neural.js"></script>
```
With:
```html
<script src="js/plasma.js"></script>
```

- [ ] **Step 3: Update CSS — rename canvas rule and add orbit styles**

In `style.css`, replace:
```css
#neural-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
```
With:
```css
#plasma-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.orbit {
  position: absolute;
  border-radius: 50%;
  border: 1px solid rgba(0, 245, 255, 0.12);
  pointer-events: none;
  transition: border-color 0.4s ease;
}

.orbit-3 {
  inset: -44px;
  animation: ring-spin 20s linear infinite;
  border-top-color: rgba(0, 245, 255, 0.3);
}

.orbit-4 {
  inset: -62px;
  animation: ring-spin 30s linear infinite reverse;
  border-right-color: rgba(80, 120, 255, 0.25);
}
```

- [ ] **Step 4: Add ring color transition to `.ai-ring::before` and `.ai-ring::after`**

Find in `style.css`:
```css
.ai-ring::before { inset: -14px; animation: ring-spin 8s linear infinite; border-top-color: var(--cyan); }
.ai-ring::after { inset: -28px; animation: ring-spin 12s linear infinite reverse; border-right-color: var(--blue); }
```

Replace with:
```css
.ai-ring::before { inset: -14px; animation: ring-spin 8s linear infinite; border-top-color: var(--cyan); transition: border-top-color 0.4s ease; }
.ai-ring::after { inset: -28px; animation: ring-spin 12s linear infinite reverse; border-right-color: var(--blue); transition: border-right-color 0.4s ease; }
```

- [ ] **Step 5: Delete neural.js**

```bash
rm /mnt/c/Users/ricqua/Desktop/Projects/command-center/js/neural.js
```

- [ ] **Step 6: Commit**

```bash
git add index.html style.css
git rm js/neural.js
git commit -m "feat: replace neural canvas with plasma-canvas scaffold, add orbit rings"
```

---

### Task 2: Create js/plasma.js — blob model and idle render loop

**Files:**
- Create: `/mnt/c/Users/ricqua/Desktop/Projects/command-center/js/plasma.js`

**Context:** This is the core file. It must work standalone — opening `index.html` in a browser with no backend should show the idle plasma immediately. The canvas fills the `.center-panel` div (full width/height). Six blobs drift with sine-wave perturbation and blend via `screen` compositing. A radial vignette darkens the edges so brightness concentrates at the center.

- [ ] **Step 1: Create js/plasma.js with full implementation**

Create `/mnt/c/Users/ricqua/Desktop/Projects/command-center/js/plasma.js` with this exact content:

```javascript
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
```

- [ ] **Step 2: Open index.html in browser and verify idle plasma**

Open `index.html` directly in Chrome/Edge (file:// is fine, no backend needed for this step).

Confirm:
- Center panel shows swirling cyan/blue/purple plasma blobs
- Plasma is visibly brighter at the center, darker at the edges
- Animation is smooth (no flicker, no errors in console)
- Mic button is still visible and clickable on top of the plasma

- [ ] **Step 3: Commit**

```bash
git add js/plasma.js
git commit -m "feat: add plasma.js with blob render loop, vignette, and state API"
```

---

### Task 3: Wire voice.js to plasma state + amplitude

**Files:**
- Modify: `/mnt/c/Users/ricqua/Desktop/Projects/command-center/js/voice.js`

**Context:** `voice.js` has a `setState(state)` function (lines 21–32) that currently updates mic button classes and the waveform. We need to add `window.plasmaSetState()` calls here. During speaking, we need a Web Audio `AnalyserNode` to feed amplitude to `window.plasmaSetAmplitude()`. The ElevenLabs path plays audio via an `Audio` element; the browser TTS path uses `SpeechSynthesis`. Each path needs its own amplitude approach.

- [ ] **Step 1: Add plasmaSetState calls to setState function**

In `js/voice.js`, replace the `setState` function:
```javascript
  function setState(state) {
    micBtn.classList.remove('active', 'speaking');
    if (state === 'listening') {
      micBtn.classList.add('active');
      setWave(true, 'var(--red)');
    } else if (state === 'speaking') {
      micBtn.classList.add('speaking');
      setWave(true, 'var(--green)');
    } else {
      setWave(false);
    }
  }
```

With:
```javascript
  function setState(state) {
    micBtn.classList.remove('active', 'speaking');
    if (state === 'listening') {
      micBtn.classList.add('active');
      setWave(true, 'var(--red)');
    } else if (state === 'speaking') {
      micBtn.classList.add('speaking');
      setWave(true, 'var(--green)');
    } else {
      setWave(false);
    }
    if (window.plasmaSetState) window.plasmaSetState(state);
  }
```

- [ ] **Step 2: Add Web Audio analyser for ElevenLabs amplitude feed**

In `js/voice.js`, replace the `speakElevenLabs` function:
```javascript
  async function speakElevenLabs(text, onEnd) {
    try {
      setState('speaking');
      const res = await fetch(`${BACKEND}/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error(`TTS status ${res.status}`);
      const blob    = await res.blob();
      const url     = URL.createObjectURL(blob);
      const audio   = new Audio(url);
      audio.onended = () => { URL.revokeObjectURL(url); setState('idle'); if (onEnd) onEnd(); };
      audio.onerror = () => { URL.revokeObjectURL(url); speakBrowser(text, onEnd); };
      await audio.play();
    } catch {
      speakBrowser(text, onEnd);
    }
  }
```

With:
```javascript
  let audioCtx    = null;
  let analyserRaf = null;

  function startAmplitudeFeed(audioEl) {
    if (!window.plasmaSetAmplitude) return;
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source   = audioCtx.createMediaElementSource(audioEl);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyser.connect(audioCtx.destination);
      const data = new Uint8Array(analyser.frequencyBinCount);
      function tick() {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += Math.abs(data[i] - 128);
        const rms = Math.min(sum / data.length / 128, 1);
        window.plasmaSetAmplitude(rms * 2.5);
        analyserRaf = requestAnimationFrame(tick);
      }
      tick();
    } catch { /* Web Audio not available — plasma still works without amplitude */ }
  }

  function stopAmplitudeFeed() {
    if (analyserRaf) { cancelAnimationFrame(analyserRaf); analyserRaf = null; }
    if (window.plasmaSetAmplitude) window.plasmaSetAmplitude(0);
  }

  async function speakElevenLabs(text, onEnd) {
    try {
      setState('speaking');
      const res = await fetch(`${BACKEND}/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error(`TTS status ${res.status}`);
      const blob  = await res.blob();
      const url   = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onplay   = () => startAmplitudeFeed(audio);
      audio.onended  = () => { stopAmplitudeFeed(); URL.revokeObjectURL(url); setState('idle'); if (onEnd) onEnd(); };
      audio.onerror  = () => { stopAmplitudeFeed(); URL.revokeObjectURL(url); speakBrowser(text, onEnd); };
      await audio.play();
    } catch {
      speakBrowser(text, onEnd);
    }
  }
```

- [ ] **Step 3: Add fallback sine-wave amplitude for browser TTS**

In `js/voice.js`, replace the `speakBrowser` function:
```javascript
  function speakBrowser(text, onEnd) {
    speechSynthesis.cancel();
    const utt    = new SpeechSynthesisUtterance(text);
    utt.voice    = pickVoice();
    utt.pitch    = 0.85;
    utt.rate     = 0.92;
    utt.volume   = 1;
    utt.onstart  = () => setState('speaking');
    utt.onend    = () => { setState('idle'); if (onEnd) onEnd(); };
    utt.onerror  = () => { setState('idle'); if (onEnd) onEnd(); };
    speechSynthesis.speak(utt);
  }
```

With:
```javascript
  let browserTtsFallbackRaf = null;

  function startBrowserTtsFallback() {
    if (!window.plasmaSetAmplitude) return;
    let t = 0;
    function tick() {
      window.plasmaSetAmplitude(0.3 + Math.sin(t * 0.08) * 0.25);
      t++;
      browserTtsFallbackRaf = requestAnimationFrame(tick);
    }
    tick();
  }

  function stopBrowserTtsFallback() {
    if (browserTtsFallbackRaf) { cancelAnimationFrame(browserTtsFallbackRaf); browserTtsFallbackRaf = null; }
    if (window.plasmaSetAmplitude) window.plasmaSetAmplitude(0);
  }

  function speakBrowser(text, onEnd) {
    speechSynthesis.cancel();
    const utt    = new SpeechSynthesisUtterance(text);
    utt.voice    = pickVoice();
    utt.pitch    = 0.85;
    utt.rate     = 0.92;
    utt.volume   = 1;
    utt.onstart  = () => { setState('speaking'); startBrowserTtsFallback(); };
    utt.onend    = () => { stopBrowserTtsFallback(); setState('idle'); if (onEnd) onEnd(); };
    utt.onerror  = () => { stopBrowserTtsFallback(); setState('idle'); if (onEnd) onEnd(); };
    speechSynthesis.speak(utt);
  }
```

- [ ] **Step 4: Open index.html in browser and test voice states**

With the backend running, click the mic button and speak a command.

Confirm:
- On click: plasma shifts to red/crimson, speeds up dramatically
- After speaking and receiving response: plasma shifts to green, pulses
- After TTS finishes: plasma returns to idle cyan/blue
- No JS errors in console

- [ ] **Step 5: Commit**

```bash
git add js/voice.js
git commit -m "feat: wire voice.js to plasma state and amplitude API"
```

---

### Task 4: Smoke test and polish

**Files:**
- Modify: `/mnt/c/Users/ricqua/Desktop/Projects/command-center/style.css` (if needed)

- [ ] **Step 1: Verify orbit rings are visible**

Open `index.html` in browser. Inspect the area around the AI ring — you should see 4 spinning rings at different radii and speeds:
- Inner two: existing `::before` (closer) and `::after` (further), cyan and blue
- Outer two: `.orbit-3` and `.orbit-4`, more transparent, larger

If orbit rings are invisible (too faint), increase their opacity in `style.css`:
```css
.orbit-3 { border-top-color: rgba(0, 245, 255, 0.4); }
.orbit-4 { border-right-color: rgba(80, 120, 255, 0.35); }
```

- [ ] **Step 2: Verify mic button is fully clickable**

Click the mic button multiple times rapidly. It should always respond. If clicks miss, check that `.mic-btn` still has `z-index: 20` and `pointer-events: all` in `style.css` (these were set in a previous session and must not have been removed).

- [ ] **Step 3: Verify plasma doesn't tank performance**

Open Chrome DevTools → Performance tab → record 5 seconds. Frame rate should stay at 55–60fps. If it drops below 30fps, reduce blob count from 6 to 4 in `plasma.js` by removing the last two blobs from the array.

- [ ] **Step 4: Commit any fixes**

```bash
git add style.css js/plasma.js
git commit -m "fix: plasma orb polish — orbit visibility, performance"
```

---

### Self-Review Notes

**Spec coverage check:**
- ✅ plasma-canvas fills center panel (Task 1 CSS)
- ✅ 6 blobs with sine-wave drift (Task 2 plasma.js)
- ✅ `screen` compositing for luminous blend (Task 2 plasma.js)
- ✅ Vignette concentrates brightness at center (Task 2 plasma.js)
- ✅ `window.plasmaSetState()` API (Task 2 plasma.js)
- ✅ `window.plasmaSetAmplitude()` API (Task 2 plasma.js)
- ✅ idle/listening/speaking state hues, speeds, radii (Task 2 + Task 3)
- ✅ Web Audio analyser for ElevenLabs amplitude (Task 3)
- ✅ Sine-wave fallback for browser TTS amplitude (Task 3)
- ✅ 2 extra orbit rings (Task 1 HTML + CSS)
- ✅ neural.js deleted (Task 1)
