# Plasma Orb — Design Spec
Date: 2026-06-14

## Overview

Replace the neural network canvas in the center panel with a living plasma orb effect. Glowing color blobs drift organically across the full center panel, brightest at the center where the AI ring sits, fading toward the edges. The plasma reacts dramatically to voice state: red/fast when listening, green/amplitude-driven when speaking.

## Visual Description

A full-panel canvas (`position: absolute; inset: 0`) underlies the existing `.ai-ring` and mic button. Six luminous color blobs (cyan, blue, indigo, teal, deep blue, purple in idle state) drift with organic sine-wave motion and blend via `screen` compositing for a luminous, otherworldly glow. A dark vignette mask concentrates brightness at the panel center, fading to near-black at the edges.

The existing two CSS spinner rings (`.ai-ring::before`, `.ai-ring::after`) remain. Two additional orbit divs (`.orbit-3`, `.orbit-4`) are added at larger radii for depth. All rings shift color with voice state via a CSS variable.

## Plasma Blob Model

Each blob:
```
{ x, y, vx, vy, baseRadius, phase, freqX, freqY }
```

- 6 blobs total
- Each tick: `x += vx + sin(tick * freqX + phase) * 0.8`, same for y
- Velocity wraps at canvas edges (blobs re-enter opposite side)
- Rendered as `createRadialGradient` from blob center outward (`baseRadius * 1.5`), from `hsla(hue, 100%, 65%, 0.6)` → transparent
- All blobs drawn with `globalCompositeOperation: 'screen'`

## Vignette Mask

After blobs are drawn, a radial gradient overlay dims the edges:
- Center (0%): `rgba(2,11,20,0)` — fully transparent, plasma shines through
- Edge (100%): `rgba(2,11,20,0.88)` — near-opaque dark, matching `--bg` color
- Gradient center anchored at canvas center

## Voice States

Managed via `window.plasmaSetState(state)` — called by `voice.js`.

### idle (default)
- Hues: cyan (185°), blue (210°), indigo (255°), teal (170°), deep blue (230°), purple (275°)
- Speed multiplier: 1.0
- Blob base radius: 120px

### listening
- Hues: red (0°), crimson (345°), magenta (310°), deep red (355°), rose (330°), orange-red (15°)
- Speed multiplier: 3.0
- Blob base radius: 150px (expanded)
- Transition: interpolate hues over 300ms

### speaking
- Hues: green (140°), teal (165°), lime (100°), emerald (155°), cyan-green (175°), yellow-green (80°)
- Speed multiplier: 2.0
- Blob base radius: 120px + amplitude × 60px (pulses with voice)
- `window.plasmaSetAmplitude(0–1)` called each animation frame from Web Audio analyser in `voice.js`

## Ring Color Transitions

CSS variable `--ring-color` set on `.ai-ring` element:
- idle: `var(--cyan)` → `rgba(0,245,255,0.25)`
- listening: `rgba(255,51,85,0.6)`
- speaking: `rgba(0,255,136,0.6)`

`.orbit-3`, `.orbit-4` border colors inherit `--ring-color` with opacity reduction.

## Amplitude Feed (voice.js)

During speaking state, `voice.js` creates a Web Audio `AnalyserNode`, reads RMS from `getByteTimeDomainData()` each animation frame, normalises to 0–1, and calls `window.plasmaSetAmplitude(rms)`.

If Web Audio is unavailable (browser TTS fallback), `plasmaSetAmplitude` is called with a slow sine wave as a fallback pulse.

## Files Changed

| File | Action | Responsibility |
|------|--------|----------------|
| `js/plasma.js` | Create | Canvas setup, blob model, render loop, state API, amplitude API |
| `js/neural.js` | Delete | Replaced by plasma.js |
| `js/voice.js` | Modify | Add `plasmaSetState()` calls at state transitions; add Web Audio analyser + amplitude feed |
| `index.html` | Modify | Replace `neural-canvas` id → `plasma-canvas`; remove `neural.js` script tag; add `plasma.js`; add `.orbit-3` and `.orbit-4` divs inside `.ai-ring` |
| `style.css` | Modify | Remove `#neural-canvas` rule; add `#plasma-canvas` (same positioning); add `.orbit-3`, `.orbit-4` ring styles; add `--ring-color` CSS variable usage on `.ai-ring::before/after` |

## No Backend Changes

Entirely frontend. No new API calls, no config changes.
