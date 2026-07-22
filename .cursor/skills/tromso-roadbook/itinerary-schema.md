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
    "alt_campsite": "…",
    "alt_scenic": "…"
  },
  "waypoints": [
    { "name": "…", "lat": 69.5, "lon": 17.4, "kind": "start|via|ferry|viewpoint|shop|depot|sleep" }
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
  "protected": false,
  "notes": "…",
  "after": "Tungeneset",
  "fallback": {
    "when": "Wind / rain",
    "then": [{ "activity": "Café", "place": "Mefjordvær", "duration_h": 0.5 }]
  }
}
```

- `protected: true` → selected by default in the UI.
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
- Selecting optionals piles duration onto following starts (`applyOptionalSelection` also updates `startMs`).
- Ferry miss retimes via `ferry.target_departure`; crossing starts at departure; queue fills wait.
- Board / Crossing / Quay collapse to one `Ferry — [route]` step with summed duration.
- After timing, `insertMealInterlines` drops Breakfast/Lunch/Dinner (with duration; shifts later `startMs`), then `insertSunInterlines` drops Sunrise/Sunset markers (no duration) ordered by `startMs`.

## Coordinate checklist

When adding or moving a place:

1. Nominatim or Overpass the named place / ferry terminal.
2. Compare to stored `lat`/`lon` (flag if > ~2 km for quays/villages, > ~5 km for trailheads).
3. Update **all** copies (baseline day, overnight, contingency `replace.waypoints`).
