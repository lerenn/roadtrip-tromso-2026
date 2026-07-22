---
name: tromso-roadbook
description: >-
  Maintains the Tromsø 2026 campervan roadbook (Vue app + itinerary JSON).
  Use when editing option A/B itineraries, depot data, chronology, scenarios,
  optionals, place photos (places.js), MapLibre/OSRM maps, waypoint coordinates,
  ferries, or GitHub Pages deploy for this repo.
---

# Tromsø 2026 roadbook

## Architecture

- **JSON is the trip.** Edit `option-a-senja-vesteralen/itinerary.json`, `option-b-senja-lyngen/itinerary.json`, and `shared/depot.json`.
- **Vue app only presents.** `app/` derives chronology and maps; do not hardcode trip facts in components.
- Key libs: `app/src/lib/chronology.js`, `scenarios.js`, `sun.js`, `osrm.js`, `gpx.js`, `places.js`.
- UI: `App.vue`, `DaySection.vue`, `RoadMap.vue`, `StepCard.vue` (expandable day timeline).

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
6. External links: set `url` on overnight / waypoints / optionals (and ferry `source`); UI opens them in a new tab. Notes with bare `https://…` are auto-linkified. Optional `maps` prefers a real `/maps/place/…` or `maps.app.goo.gl/…` link for StepCard “Open in Google Maps”; for vague non-POI stops use named `maps/search/?api=1&query=…` (no GPS), or omit so lat/lon fallback applies. Registry: `app/src/lib/maps-places.json`. Scenic Route rest areas / viewpoints (e.g. Senja NTV stops) may use the official route URL when no operator or campsite site exists; keep specific operator/booking URLs when present.
7. StepCard badges: `must` / `optional` / `protect` / `sleep` / `ferry` / `stop` (viewpoint stops — chronology titles stay `Stop — …`, UI strips the prefix) / `reserve` (`reserve: true` on overnight / waypoint / optional). Use `reserve` for bookable campsites and activities (whale safari, guided kayak, sauna); skip scenic allemannsretten nights, first-come ferries, and campsites that do not take motorhome/tent pitch reservations (e.g. Midnattsol Camping, Bleik). Depot pickup/return are already fixed appointments — leave unmarked.
8. Sunrise/sunset are timeline markers only (`insertSunInterlines`). Meals are interlines that **consume time** (`insertMealInterlines`: breakfast ~08:00 0.3h, lunch ~12:30 0.75h, dinner ~19:00 0.85h; skip breakfast on Day 1 and lunch/dinner on Day 8) and re-slot the clock. Day 8 breakfast is shown but does **not** consume time, so it cannot slide the locked return. Meals do **not** set `timeShifted` / colored `*` — that marker is only for selected optionals (`applyOptionalSelection`).
9. Cover hero swaps by option: `app/public/hero-option-a.jpg` (Bleik / Andøya) and `hero-option-b.jpg` (Blåisvatnet / Lyngen); credits live in `App.vue` `HEROES`.
10. Depot appointments: Day 1 clock starts at `depot.pickup` (15:30); Day 8 **Return camper** is locked to `depot.return` (11:30), with `dayStartClock` working back through `drive_h_approx` + start linger so the morning drive lands on that appointment.

## Place photos

- Timeline rows expand in `StepCard`; photos come from `app/src/lib/places.js` (`imageForStep` matches place / activity / optLabel). Each expanded step links to Google Maps bottom-right (`maps` place URL when set, else `lat`/`lon` query).
- **Accuracy first:** every registry entry must depict that real place. No scenic stand-ins. Prefer no photo over a wrong one.
- Hotlink remote thumbs (do **not** download into `app/public/places/`). Prefer Wikimedia Commons 1280px thumbs; verify the Commons hash path (wrong prefix → 404).
- If Commons has nothing: Unsplash/Pexels CDN, Flickr static, Mapillary at the stop coords, Visit Norway / destination sites, or your own photo.
- Per-item override on waypoint / overnight / optional: `image`, `imageAlt`, `imageCredit`, `imagePage` (propagated through `chronology.js`).
- Private trip use only — do not republish non-free assets publicly without a license.

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
- Optionals: protected default on; plain optionals off; selection shifts later starts and marks them with `*` (`applyOptionalSelection`).
- Selected optionals with `lat`/`lon` reshape the day map / GPX via `routingWaypoints`. Plain same-stop activities (already ~400 m from a must waypoint, e.g. Hamn kayak) do not duplicate pins. **Protected / `reserve` activities** at an existing stop still get a labelled pin (activity name) so bookable quay stops like whale safari stay visible. Co-located quay pins (ferry + harbour + activity) are fan-out nudged on the map for readable labels only — routing/GPX keep true coords. Detours (Bøvær, Hesten/Fjordgård, Stø, Stokmarknes museum, …) must include coords + an `after` anchor.

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
- Use scenic stand-in photos or download place thumbs into `app/public/places/`
- Treat meal clock shifts as optional `*` time-shift markers

## Maintenance

When this project's lasting conventions change, update this skill and/or `itinerary-schema.md` in the same change. Keep `AGENTS.md` and `.cursor/rules/tromso-roadbook.mdc` in sync if top-level pointers drift. See `AGENTS.md`.
