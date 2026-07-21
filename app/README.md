# Tromsø 2026 · Vue roadbook

Presentation layer for the campervan itinerary. **JSON is the trip** (`../option-*/itinerary.json`, `../shared/depot.json`). This app only derives chronology and renders maps.

## Run

```bash
cd app
npm install
npm run dev
```

Open the printed local URL (usually `http://localhost:5173`).

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
