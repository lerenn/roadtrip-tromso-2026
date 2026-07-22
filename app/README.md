# Tromsø 2026 · Vue roadbook

Presentation layer for the campervan itinerary. **JSON is the trip** (`../option-*/itinerary.json`, `../shared/depot.json`). This app only derives chronology and renders maps.

## Run

From the repo root:

```bash
make start    # http://127.0.0.1:5173/
make stop
make status
```

Or from this folder:

```bash
npm install
npm run dev
```

## Build

```bash
npm run build   # → dist/
npm run preview
```

Production base path for GitHub Pages is set automatically in CI from `GITHUB_REPOSITORY` (→ `/roadtrip-tromso-2026/`). Local builds keep `/`. Override with `VITE_BASE` if needed.

Deploy: push to `main` runs [`.github/workflows/pages.yml`](../.github/workflows/pages.yml). Site: https://lerenn.github.io/roadtrip-tromso-2026/

## Stack

- Vue 3 + Vite
- Chronology: `src/lib/chronology.js` (from itinerary JSON)
- Maps: MapLibre GL + OSRM (dev proxy `/osrm` → public OSRM; production hits OSRM directly)
- GPX download in the browser

## Edit the trip

Change waypoints / optionals / ferries in the option `itinerary.json` files, then refresh the app.

Day notes (`day.notes`) can be plain strings (auto-placed on depot / shop / ferry / sleep) or objects:

```json
{ "text": "Stock groceries + water before leaving Tromsø.", "kind": "shop" }
```

`kind` may be `depot`, `shop`, `sleep`, `viewpoint`; or use `after` / `during` / `place` like optionals. Set `"ferry": true` to pin a note on the ferry crossing.

Fail scripts are integrated in the JSON (no global switch):

- **Day-level** — `day.scenarios[]` with `when`, `replace` for that day, optional `ripple` for later days. In the UI these appear as checkboxes at the top of each day; selecting one (or several) swaps the roadbook for that contingency. Use `"attach": "ferry_crossing"` to put the toggle on the ferry crossing line instead. Nested `replace` fields (e.g. `ferry.target_departure`) deep-merge into the day.
- **Line-level** — `optional[].fallback` with `when` + `then` alternate activities under a step.
