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
      "image": "https://…"
    }
  ],
  "ferry": {
    "route": "181 Brensholmen → Botnhamn",
    "duration_min": 45,
    "target_departure": "10:15",
    "backup": ["12:15"],
    "note": "…",
    "source": "https://…"
  },
  "notes": [],
  "optional": [],
  "scenarios": []
}
```

Waypoint `kind` drives map styling and chronology. Consecutive ferry quays (`kind: "ferry"`) become a dashed crossing, not an OSRM drive.

`maps` (optional): prefer a real Google Maps place page (`/maps/place/…`) or short link (`maps.app.goo.gl/…`). For vague non-POI stops, use named search `https://www.google.com/maps/search/?api=1&query=…` (no GPS) or omit for lat/lon fallback. Same field on overnight / optionals. See `app/src/lib/maps-places.json`.

`reserve` (optional boolean): set `true` when a reservation/booking is typically needed or strongly recommended (named campsites with booking, whale safari, guided kayak, bookable sauna). StepCard shows a `reserve` badge alongside must/optional/protect/sleep. Omit for scenic allemannsretten nights, first-come ferries, and campsites that do not accept motorhome/tent pitch reservations (e.g. Midnattsol Camping, Bleik — keep their info URL, just no `reserve`). Depot pickup/return are already locked appointments — leave unmarked.

## Notes

Plain string → auto-placed (depot / shop / ferry / sleep heuristics).

Preferred object forms:

```json
{ "text": "Stock water.", "kind": "shop" }
{ "text": "Evening light.", "after": "Tungeneset" }
{ "text": "Crossing tip.", "ferry": true }
```

`kind`: `depot` | `shop` | `sleep` | `viewpoint`. Also accepts `after` / `during` / `place` like optionals.

## Optionals

```json
{
  "activity": "Tungeneset boardwalk",
  "place": "Tungeneset",
  "duration_h": 0.75,
  "url": "https://…",
  "protected": false,
  "notes": "…",
  "after": "Tungeneset",
  "fallback": {
    "when": "Wind / rain",
    "then": [{ "activity": "Café", "place": "Mefjordvær", "duration_h": 0.5, "url": "https://…" }]
  }
}
```

- `url` / ferry `source` → clickable new-tab links in the UI (`ExtLink`).
- Photo: registry match in `app/src/lib/places.js`, or override with `image` / `imageAlt` / `imageCredit` / `imagePage` (same fields on waypoints / overnight). Must be the real place; omit if none.
- Detours that should reshape the day map when selected need `lat` / `lon` (and usually `after`). Plain same-place activities may omit coords or include them — the router skips near-duplicates (under ~400 m). **Protected / `reserve` activities** with coords still get a map pin even at an existing stop (labelled with the activity name).
- `protected: true` → selected by default in the UI.
- `reserve: true` → StepCard `reserve` badge (book ahead when possible). Same field on overnight / waypoints.
- `after` / `during` / `place` anchors insertion into the step list.
- `fallback` is line-level only (shown under the step), not a day swap.

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

- Omit `attach` (or anything other than `ferry_crossing`) → checkbox at top of day.
- `attach: "ferry_crossing"` → toggle on the merged ferry step.
- Scenario `id` is shared across anchor + ripples for multi-select state.
- Nested `replace` keys deep-merge; arrays (`waypoints`, `notes`, `optional`) replace entirely.

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
