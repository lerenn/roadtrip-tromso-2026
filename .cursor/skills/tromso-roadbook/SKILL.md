---
name: tromso-roadbook
description: >-
  Maintains the Tromsø 2026 campervan roadbook (Vue app + itinerary JSON).
  Use when editing option A/B itineraries, depot data, chronology, scenarios,
  optionals, MapLibre/OSRM maps, waypoint coordinates, ferries, or GitHub Pages
  deploy for this repo.
---

# Tromsø 2026 roadbook

## Architecture

- **JSON is the trip.** Edit `option-a-senja-vesteralen/itinerary.json`, `option-b-senja-lyngen/itinerary.json`, and `shared/depot.json`.
- **Vue app only presents.** `app/` derives chronology and maps; do not hardcode trip facts in components.
- Key libs: `app/src/lib/chronology.js`, `scenarios.js`, `osrm.js`, `gpx.js`.
- UI: `App.vue`, `DaySection.vue`, `RoadMap.vue`.

```bash
make start    # http://127.0.0.1:5173/
make build    # app/dist
```

## Trip constraints (locked)

- Pickup Sat 29 Aug 2026 15:30 → return Sat 5 Sep 2026 11:30, Indie Campers Tromsø
- Depot: Håndverkervegen 6 — coords in `shared/depot.json` (verify before changing)
- Options A (Senja + Vesterålen) and B (Senja + Lyngen); English; short walks; ~50/50 scenic/campsite nights; last night near Tromsø
- Skip repeating Tromsø/Sommarøy (week 2 after camper)
- **Privacy:** no booking codes, personal names, or private contact details in repo/UI

## Editing rules

1. Prefer changing itinerary JSON over app logic for trip content.
2. Keep A and B contingency/optional patterns consistent when adding the same kind of what-if.
3. Every ferry crossing should have a miss contingency with `"attach": "ferry_crossing"`.
4. Day notes: structured `{ text, kind|after|during|ferry }` preferred; plain strings auto-infer.
5. Ferry UI merges Board / Crossing / Quay into one step (`mergeFerrySteps`); miss toggles still use `step.ferry`.

## Maps & coordinates

- Itinerary fields are `lat` / `lon`. MapLibre / GeoJSON / OSRM use **`[lon, lat]`**.
- Never invent coords from memory. Geocode with Nominatim or OSM ferry terminals (Overpass `amenity=ferry_terminal`) and compare haversine distance.
- Past footguns: depot in water; Blåisvatnet ~30 km south of real Sørlenangsbotn parking; approximate Senja/Vesterålen pins off by 3–8 km.
- Ferries: OSRM drives road segments; ferry hops are straight dashed lines between consecutive `kind: "ferry"` waypoints.

## Contingencies & optionals

See [itinerary-schema.md](itinerary-schema.md) for field shapes.

- Day-level: `day.scenarios[]` — top-of-day checkboxes unless `attach: "ferry_crossing"`.
- `replace` deep-merges nested objects (e.g. `ferry.target_departure`); arrays replace.
- `ripple` patches later days when the same scenario id is selected.
- Optionals: protected default on; plain optionals off; selection shifts later starts (`applyOptionalSelection`).

## Deploy notes

- Static site = Vite build of `app/` (`make build` → `app/dist`).
- GitHub Pages: `.github/workflows/pages.yml` builds on `main` and deploys `app/dist`.
- Vite `base` comes from `GITHUB_REPOSITORY` in CI (`/roadtrip-tromso-2026/`); local stays `/`. Override with `VITE_BASE`.
- Public assets in templates must use `import.meta.env.BASE_URL` (see hero in `App.vue`).
- OSRM: dev uses `/osrm` proxy; production calls `https://router.project-osrm.org` directly (CORS-tolerant; falls back to straight lines if blocked).
- Repo Settings → Pages → Source must be **GitHub Actions** (one-time).

## Do not

- Commit secrets, booking codes, or personal PII
- Swap lat/lon when writing JSON
- Route ferries as driving legs in OSRM
- Dump all day notes only on the overnight step
