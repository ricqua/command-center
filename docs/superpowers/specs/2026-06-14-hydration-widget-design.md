# Hydration Widget — Design Spec
Date: 2026-06-14

## Overview

Add a hydration tracking widget to the right panel of the Nightfall Command Center, below the `// RECENT · WORKSPACE` section. The widget tracks daily water intake against a 14-glass target, shows a time-of-day progress marker, and visually signals when the user is overdue for a drink.

## User Context

- Age: 38, Weight: 90kg, goal: weight loss + hydration
- Daily target: 14 glasses (250ml each = 3.5L)
- Active office hours: 8:00am – 6:00pm (10 hours)
- No voice reminders — visual signal only

## Visual Layout

```
// HYDRATION

[████████▲░░░░░░] 8 / 14
 ← TIME TARGET

[+ DRINK]  [RESET]

STATUS: ON TRACK
```

- Progress bar fills cyan left-to-right as glasses are logged
- A `▲` marker sits on the bar at the position representing the expected count for the current time of day
- `+ DRINK` button: logs one glass; color reflects urgency status
- `RESET` button: clears today's count (requires a second click to confirm)
- Status text below buttons: `ON TRACK`, `DRINK SOON`, or `OVERDUE`

## Status Logic

Status is only active during office hours (08:00–18:00). Outside those hours, no urgency signaling — widget shows total only.

**Expected count at time T:**
```
expected = floor((T - 8:00) / 10h * 14)
```
where T is clamped to [08:00, 18:00].

| Condition | Button color | Status text |
|-----------|-------------|-------------|
| actual >= expected | Cyan (normal) | ON TRACK |
| actual == expected - 1 | Amber | DRINK SOON |
| actual <= expected - 2 | Red (pulsing) | OVERDUE |

## Time Marker

The `▲` marker is positioned as a percentage along the progress bar:
```
markerPct = (expected / 14) * 100
```

The marker is rendered as an absolutely-positioned element above the bar. It moves smoothly throughout the day as time passes (updated every minute).

## Storage

Uses `localStorage` with key `nf_hydration`. Value:
```json
{ "date": "2026-06-14", "count": 8 }
```

On page load: if stored date !== today, reset count to 0. This auto-clears at the start of each new day without any server-side logic.

## Reset Confirmation

`RESET` button requires a second click to confirm:
- First click: button text changes to `CONFIRM?` and turns amber
- Second click (within 3 seconds): resets count to 0
- If no second click within 3 seconds: reverts to `RESET`

## Update Frequency

The urgency check and marker position update every 60 seconds via `setInterval`.

## Files Changed

| File | Action | Responsibility |
|------|--------|----------------|
| `js/hydration.js` | Create | All hydration logic: storage, status calc, render, button handlers |
| `index.html` | Modify | Add `// HYDRATION` section to right panel + script tag |
| `style.css` | Modify | Hydration bar, marker, button urgency states |

## No Backend Required

All logic is client-side. No server polling, no API calls, no new backend routes.
