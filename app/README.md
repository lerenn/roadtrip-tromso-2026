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

## Stack

- Vue 3 + Vite
- Chronology: `src/lib/chronology.js` (from itinerary JSON)
- Maps: MapLibre GL + OSRM (dev proxy `/osrm` → public OSRM)
- GPX download in the browser

## Edit the trip

Change waypoints / optionals / ferries in the option `itinerary.json` files, then refresh the app.
