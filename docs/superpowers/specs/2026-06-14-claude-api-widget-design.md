# Claude API Usage Widget — Design Spec
Date: 2026-06-14

## Overview

Add a Claude API usage widget to the left panel of the Nightfall Command Center, positioned above `// PROJECTS`. The widget shows a GitHub-style token usage heatmap (months × days-of-week), remaining credit balance, and current-month token/cost summary.

## Placement

Left panel (`panel-left` in `index.html`), inserted **before** the `// PROJECTS` panel label and `#project-list` div. The widget is its own section with a `// CLAUDE API` label.

## Visual Layout

```
// CLAUDE API

[heatmap grid: 53 columns (weeks) × 7 rows (Mon–Sun)]
 Mon ░░▒▒██░░▒░░...
 Tue ...
 ...
 Sun ...
     Jan  Feb  Mar  Apr  May  Jun  ...

BALANCE REMAINING
$12.40  [████████░░░░]  of $50.00

INPUT 1.2M · OUTPUT 340K · EST. $4.80 THIS MONTH
```

- Heatmap cells: 4-level intensity using cyan/teal theme vars (`--cyan`, `--blue`, dimmed variants, near-black for zero)
- Balance bar: green gradient matching existing `bk-bar` / `bk-bar-fill` style
- Stats row: small label text, consistent with existing `kpi-label` / `kpi-value` patterns

## Data Source

**Anthropic Usage API** — `GET https://api.anthropic.com/v1/usage/tokens?granularity=daily` with header `x-api-key: <anthropic_api_key>`. Returns per-day input/output token counts. Cost is estimated client-side: input tokens × $0.00000025 + output tokens × $0.00000125 (Haiku 4.5 pricing).

The backend polls this endpoint once per hour and caches the result in memory. A new `/anthropic-usage` route serves the cached data to the frontend.

## Backend Changes (`backend/server.py`)

1. New in-memory cache: `anthropic_usage_cache = None`, `anthropic_usage_fetched = 0`
2. New function `fetch_anthropic_usage()` — calls the Anthropic usage API, transforms response into `{ dates: [...], input_tokens: [...], output_tokens: [...], cost_usd: [...] }` covering the last 365 days
3. Background thread refreshes the cache every 3600 seconds
4. New route handler for `GET /anthropic-usage` — returns cached JSON (or empty structure if API fails)

## Frontend Changes

### `js/anthropic.js` (new file)

- `fetchAndRender()` — fetches `/anthropic-usage`, renders heatmap, balance bar, stats row
- `renderHeatmap(data)` — builds a 53×7 CSS grid; maps cost per day to 4 intensity levels; labels months below columns
- `renderBalance(totalSpend)` — reads `config.json`-sourced balance from `/config` endpoint (or a new field), computes remaining, updates bar
- `renderStats(data)` — sums current-month input/output tokens and estimated cost
- Polls every 3600s (matches backend refresh)

### `index.html`

- New `// CLAUDE API` section block inserted before `// PROJECTS` in `panel-left`
- Contains: heatmap container `#claude-heatmap`, balance row `#claude-balance`, stats row `#claude-stats`

### `config.json`

- New field: `"anthropic_credit_usd": 50.00` — user sets this once to their current account balance

### `style.css`

- `.heatmap-grid` — CSS grid layout for the 53×7 cell matrix, small cells (~7px), gap 2px
- `.heatmap-cell` — base cell style, border-radius 1px
- `.hm-0 / .hm-1 / .hm-2 / .hm-3` — intensity classes using theme color vars
- `.heatmap-labels` — month label row beneath the grid
- `.heatmap-day-labels` — Mon–Sun labels on the left

## Error Handling

- If `/anthropic-usage` returns empty or fails, heatmap shows all cells as `.hm-0` (no data), stats show `—`, balance bar stays at last known value
- Balance remaining can't go below $0 in the display

## Config Route

The existing `/config` endpoint already serves `config.json` to the frontend. `anthropic_credit_usd` will be read from there by `anthropic.js`. No new endpoint needed.

## Files Changed

| File | Change |
|------|--------|
| `backend/server.py` | Add `/anthropic-usage` route + hourly background fetch |
| `js/anthropic.js` | New file — heatmap render + balance + stats |
| `index.html` | New `// CLAUDE API` section in left panel |
| `style.css` | Heatmap grid styles |
| `config.json` | Add `anthropic_credit_usd` field |
