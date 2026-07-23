# Itinerary schema (A / B)

Source of truth: `option-*/itinerary.json`. Shared depot: `shared/depot.json`.

## Day skeleton

```json
{
  "day": 2,
  "date": "2026-08-30",
  "weekday": "Sunday",
  "title": "…",
  "drive_km_approx": 120,
  "drive_h_approx": 3.5,
  "overnight": {
    "name": "…",
    "type": "scenic|campsite",
    "lat": 69.5,
    "lon": 17.4,
    "url": "https://…",
    "reserve": true,
    "scenic": true,
    "price": "550 NOK / night pitch for the van",
    "image": "https://…",
    "imageAlt": "…",
    "imageCredit": "…",
    "imagePage": "https://…",
    "alt_campsite": "…",
    "alt_scenic": "…"
  },
  "waypoints": [
    {
      "name": "…",
      "lat": 69.5,
      "lon": 17.4,
      "kind": "start|via|ferry|viewpoint|shop|depot|sleep",
      "url": "https://…",
      "maps": "https://maps.app.goo.gl/…",
      "reserve": true,
      "scenic": true,
      "image": "https://…"
    }
  ],
  "ferry": {
    "route": "181 Brensholmen → Botnhamn",
    "duration_min": 45,
    "target_departure": "10:15",
    "backup": ["12:15"],
    "note": "…",
    "source": "https://…",
    "price": "247 NOK / van ≤6 m (our 5.99 m; 2026; AutoPASS/FerryPay; passengers free)"
  },
  "notes": [],
  "optional": [],
  "scenarios": []
}
```

Waypoint `kind` drives map styling and chronology. Consecutive ferry quays (`kind: "ferry"`) become a dashed crossing, not an OSRM drive.

`kind: "via"` and bare morning `kind: "start"` are **map / routing markers only**: they shape the day map + OSRM/GPX spine and can anchor notes/optionals, but they do **not** get a timeline StepCard. Drive rows merge across consecutive vias, and a morning `start` is only the departure pin (first useful line is the Drive away, e.g. Bleik → Kleivodden). Use `viewpoint` / `shop` / `depot` / `ferry` / `sleep` when the place should appear as a line in the chronology.

`maps` (optional): prefer a real Google Maps place page (`/maps/place/…`) or short link (`maps.app.goo.gl/…`). For vague non-POI stops, use named search `https://www.google.com/maps/search/?api=1&query=…` (no GPS) or omit for lat/lon fallback. Same field on overnight / optionals. See `app/src/lib/maps-places.json`.

`reserve` (optional boolean): set `true` when a reservation/booking is typically needed or strongly recommended (named campsites with booking, whale safari, guided kayak, bookable sauna). StepCard shows a `reserve` badge alongside must/optional/sleep. Omit for scenic allemannsretten nights, first-come ferries, and campsites that do not accept motorhome/tent pitch reservations (e.g. Midnattsol Camping, Bleik — keep their info URL, just no `reserve`). Depot pickup/return are already locked appointments — leave unmarked.

`scenic` (optional boolean): set `true` when the stop is on an official Nasjonale turistveger / Norwegian Scenic Route (Senja, Andøya, …) — viewpoints, NTV-listed villages/quays on the spine, and NTV-listed detours (e.g. Bøvær). StepCard shows a purple `scenic` badge (CSS `--scenic`). Do **not** mark campsites or operator hubs that only sit near the route (Midnattsol, Hamn) unless the stop itself is an NTV-listed Scenic Route point. Overnight `type: "scenic"` is separate (wild camping vs campsite); the UI displays that type as **wild**.

`price` (optional string): short human-readable tariff for the step (campsite pitch/night, ferry vehicle crossing, activity adult ticket, etc.). Always say **what** is priced. Trip baseline: **2 adults** + van **5.99 m** (≤6 m ferry bracket) in `shared/depot.json` — prefer party totals for tickets (`2×…`) and exact ≤6 m van ferry fares; mark year/tariff uncertainty in the string (e.g. `(2025 tariff)`, `(guest-reported)`). Never invent exact figures — omit the field if no credible public source. StepCard shows a compact **NOK** (or range) on the **right** of the summary with a smaller approx **EUR** (`app/src/lib/money.js`); full text under **Price** when expanded. Same field on overnight, ferry, optionals, and optional `fallback.then[]` items.

## Notes

Plain string → auto-placed (depot / shop / ferry / sleep heuristics).

Preferred object forms:

```json
{ "text": "Stock water.", "kind": "shop" }
{ "text": "Evening light.", "after": "Tungeneset" }
{ "text": "Crossing tip.", "ferry": true }
{ "text": "Road may close for launches…", "kind": "warning", "during": "Drive", "after": "Måtinden" }
{ "text": "Same warning via leg.", "kind": "warning", "leg": "Måtinden → Bukkekjerka" }
```

`kind`: `depot` | `shop` | `sleep` | `viewpoint` | `warning`. Also accepts `after` / `during` / `place` / `leg` like optionals.

Drive warnings: use `during: "Drive"` plus `after` (departure stop name) or `leg: "From → To"` matching the Drive step’s `place`. `kind: "warning"` (or `warning: true`) sets a **warning** badge on that Drive StepCard and labels the expanded notes as Warning.

## Optionals

```json
{
  "activity": "Tungeneset boardwalk",
  "place": "Tungeneset",
  "duration_h": 0.75,
  "url": "https://…",
  "scenic": true,
  "reserve": true,
  "price": "2×1690 NOK ≈ 3380 NOK for 2 adults",
  "notes": "…",
  "after": "Tungeneset"
}
```

- `url` / ferry `source` → clickable new-tab links in the UI (`ExtLink`).
- Photo: registry match in `app/src/lib/places.js`, or override with `image` / `imageAlt` / `imageCredit` / `imagePage` (same fields on waypoints / overnight). Must be the real place; omit if none.
- Detours that should reshape the day map when selected need `lat` / `lon` (and usually `after`). Plain same-place activities may omit coords or include them — the router skips near-duplicates (under ~400 m). **`reserve` activities** with coords still get a map pin even at an existing stop (labelled with the activity name).
- All optionals are off by default; the user opts in via the timeline checkbox.
- Prefer **separate optionals** over line-level `fallback` blocks — list alternatives as their own optionals (same day) so they can be selected independently. Day-level `scenarios[]` are for ferry misses and overnight swaps (campsite/wild), not whole-day weather scripts.
- `reserve: true` → StepCard `reserve` badge (book ahead when possible). Same field on overnight / waypoints.
- `scenic: true` → StepCard purple `scenic` badge (official Scenic Route stop). Same field on overnight / waypoints.
- `price` → short tariff string shown on the timeline (see `price` above). Same field on overnight / ferry / optionals.
- `after` / `during` / `place` anchors insertion into the step list.

## Scenarios (day-level)

```json
{
  "id": "miss-brensholmen-1015",
  "when": "Miss the 10:15 Brensholmen ferry",
  "summary": "Take 12:15; compress Senja afternoon.",
  "attach": "ferry_crossing",
  "replace": {
    "title": "…",
    "ferry": { "target_departure": "12:15" },
    "notes": [],
    "optional": [],
    "waypoints": []
  },
  "ripple": [
    {
      "day": 3,
      "banner": "…",
      "replace": { "notes": [] }
    }
  ]
}
```

- Omit `attach` (or anything other than `ferry_crossing` / `overnight`) → checkbox at top of day.
- `attach: "ferry_crossing"` → toggle on the merged ferry step (“If missed”).
- `attach: "overnight"` → toggle on the Overnight / sleep StepCard (“Prefer campsite” for `campsite_alt_*`, “Prefer wild” for `wild_alt_*`).
- Scenario `id` is shared across anchor + ripples for multi-select state. Keep ids unique within an itinerary (e.g. one `campsite_alt_*` per scenic night, one `wild_alt_*` per campsite night).
- Nested `replace` keys deep-merge; arrays (`waypoints`, `notes`, `optional`) replace entirely.

### Wild overnight → campsite contingency

For each day with `overnight.type: "scenic"`, add a scenario with `"attach": "overnight"` so the default stays wild and checking the box on the Overnight step switches to a bookable campsite:

```json
{
  "id": "campsite_alt_brensholmen",
  "when": "Prefer a campsite instead of wild overnight",
  "summary": "Sleep at the named campsite; showers/power; still reach tomorrow’s start.",
  "attach": "overnight",
  "banner": "Campsite alt — …",
  "replace": {
    "overnight": {
      "name": "…",
      "type": "campsite",
      "lat": 69.63,
      "lon": 17.98,
      "url": "https://…",
      "maps": "https://www.google.com/maps/search/?api=1&query=…",
      "reserve": true,
      "alt_campsite": null,
      "alt_scenic": null,
      "scenic": false
    },
    "waypoints": [],
    "notes": []
  },
  "ripple": [
    {
      "day": 6,
      "banner": "Campsite alt — start from …",
      "replace": { "waypoints": [] }
    }
  ]
}
```

- Prefer the campsite hinted in `alt_campsite` (upgrade free text to a real POI). If the hint is vague (“roadside pull-offs”), pick the best named campsite near that night and say so in notes.
- Geocode with Nominatim (`User-Agent: roadtrip-tromso-2026/1.0`); never invent coords. Reuse campsites already on the trip when they match.
- `replace.waypoints` must update the final `kind: "sleep"` pin to the campsite (and add a via if the campsite is a meaningful detour off the must spine).
- Set `reserve: true` only when the site takes pitch bookings; omit for walk-up / VIPPS-only motorhome pitches.
- Because `replace.overnight` **deep-merges**, clear wild leftovers explicitly: `"alt_campsite": null`, `"alt_scenic": null`, `"scenic": false` (otherwise the scenic night’s fields linger).
- Ripple the next day when the new overnight makes the default start waypoint wrong.

### Campsite overnight → wild contingency

For each day with `overnight.type: "campsite"`, add the **mirror** scenario with `"attach": "overnight"` so the default stays campsite and checking the box on the Overnight step switches to a wild / allemannsretten pin:

```json
{
  "id": "wild_alt_mefjord",
  "when": "Prefer wild overnight instead of Camp Mefjord",
  "summary": "Sleep a quiet pull-off near the village if the campsite is full or you skip facilities.",
  "attach": "overnight",
  "banner": "Wild alt — Mefjordvær village pull-off",
  "replace": {
    "overnight": {
      "name": "Mefjordvær village / harbour pull-off",
      "type": "scenic",
      "lat": 69.51864,
      "lon": 17.43821,
      "maps": "https://…",
      "url": null,
      "reserve": null,
      "price": null,
      "alt_scenic": null,
      "alt_campsite": "Camp Mefjord, Mefjordvær",
      "scenic": true
    },
    "waypoints": [],
    "notes": []
  },
  "ripple": [
    {
      "day": 3,
      "banner": "Wild alt — start from …",
      "replace": { "waypoints": [] }
    }
  ]
}
```

- Prefer the place hinted in `alt_scenic`. If vague (“E6 pull-off”, “Fjellveggen”), pick the best named parking / Scenic Route rest area near that night and say so in the sleep note.
- Geocode with Nominatim; never invent coords. Reuse pins already on the day spine when they match (e.g. Tungeneset, Bleik beach, Svensby quay).
- `replace.waypoints` must update the final `kind: "sleep"` pin to the wild spot.
- Because `replace.overnight` **deep-merges**, clear campsite leftovers explicitly: `"url": null`, `"reserve": null`, `"price": null`, `"alt_scenic": null`. Set `alt_campsite` to the facilities default you left. Use `"scenic": true` only when the wild pin itself is an official Scenic Route stop.
- Ripple the next day when the wild overnight makes the default start waypoint wrong (e.g. Tungeneset vs Camp Mefjord, Telegrafbukta vs Tromsø Lodge). Same-village swaps (Camp Mefjord ↔ Mefjordvær pull-off) usually need no ripple.
- Do **not** also dump `alt_campsite` / `alt_scenic` as free-text on the Overnight notes — the StepCard checkbox is the UX.

## Chronology behaviour

- Mandatory path sets the baseline clock; unselected optionals do not shift later steps.
- Selecting optionals piles duration onto following starts (`applyOptionalSelection` also updates `startMs`) and sets `timeShifted` / `*` / `shiftSources` (optionals only).
- Day map / GPX use `routingWaypoints(day, selectedOptIds)`: must `waypoints` plus selected optional detours with coords.
- Ferry miss retimes via `ferry.target_departure`; crossing starts at departure; queue fills wait.
- Board / Crossing / Quay collapse to one `Ferry — [route]` step with summed duration.
- Day 1 starts at `shared/depot.json` `pickup` (15:30). Day 8 **Return camper** is locked to `return` (11:30); the day clock works back from that appointment through `drive_h_approx` (keep ~0.5 h / ~15 km from the Tromsø buffer overnight).
- After timing, `insertMealInterlines` drops Breakfast/Lunch/Dinner (with duration; shifts later `start` / `startMs`) but does **not** set `timeShifted`. Day 8 breakfast is display-only (no clock shift) so it cannot push Return past 11:30. Then `insertSunInterlines` drops Sunrise/Sunset markers (no duration) ordered by `startMs`.
- Drive steps and sun/meal interlines do not show place photos.

## Place photos

- Default: hotlinked match from `places.js` by place / activity name.
- Override: `image` (+ optional `imageAlt`, `imageCredit`, `imagePage`) on waypoint, overnight, or optional — passed through chronology into `StepCard`.
- Prefer accurate Wikimedia thumbs; leave unmatched rather than using a stand-in.

## Coordinate checklist

When adding or moving a place:

1. Nominatim or Overpass the named place / ferry terminal.
2. Compare to stored `lat`/`lon` (flag if > ~2 km for quays/villages, > ~5 km for trailheads).
3. Update **all** copies (baseline day, overnight, contingency `replace.waypoints`).
