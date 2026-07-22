# Roadtrip Tromsø 2026

Campervan roadbook — Indie Campers Active Pop Top.

| | |
| --- | --- |
| Pickup | **Sat 29 Aug 2026, 15:30** — Indie Campers Tromsø |
| Return | **Sat 5 Sep 2026, 11:30** — same depot |
| Nights | 7 (last night **near Tromsø**) |
| Mix | ~50/50 scenic overnight / campsite |
| Language | English |
| After | Extra week in Tromsø (keep local day trips for then) |

## Roadbook app (presentation)

The trip lives in JSON. The Vue app only presents it (live chronology + MapLibre maps):

```bash
make start    # http://127.0.0.1:5173/
make stop
make status
```

Or manually: `cd app && npm install && npm run dev`.

**Live:** [lerenn.github.io/roadtrip-tromso-2026](https://lerenn.github.io/roadtrip-tromso-2026/) (GitHub Pages — deploys from `main` via Actions).

See [`app/README.md`](app/README.md).

## Alternatives (data)

| Option | Theme | Data | When to pick |
| --- | --- | --- | --- |
| **[A — Senja + Vesterålen](option-a-senja-vesteralen/)** | Coastal loop + Gryllefjord→Andenes ferry | [`itinerary.json`](option-a-senja-vesteralen/itinerary.json) | Default if the ferry queue works |
| **[B — Senja + Lyngen](option-b-senja-lyngen/)** | Senja then alpine Lyngen | [`itinerary.json`](option-b-senja-lyngen/itinerary.json) | If ferry is full/cancelled, or you prefer peaks/glaciers |

Shared depot: [`shared/depot.json`](shared/depot.json).

Both options:

- Skip repeating Tromsø/Sommarøy (save for week 2)
- Short walks only (0–5 km)
- Cook in the van; mid-range budget
- Phone + drone (respect bird cliffs / no-fly zones)
- Whale safari: **book if weather/spots look good** (Andenes — Option A)
- Day 6 kept flexible for weather / ferry slip

## Quick ferry cheat-sheet (verify before travel)

| Crossing | Useful for | Tip |
| --- | --- | --- |
| Brensholmen → Botnhamn (181) | A + B, Sun 30 Aug | Sunday from Brensholmen includes **10:15** |
| Gryllefjord → Andenes (180) | A only, Tue 1 Sep | Season until ~27 Sep 2026; from 24 Aug only **11:00 / 19:00**; **no car booking** — queue early |
| Breivikeidet ↔ Svensby (191) | B | Frequent, ~20 min |
| Lyngseidet ↔ Olderdalen (190) | B | Frequent, ~40 min |

Official sources: [Svipper ferry PDFs](https://svipper.no/menu/travel/timetables-and-maps/ferry-routes/), [Havspor](https://havspor.no/).

## Preferences locked in

- Hiking: short walks
- Driving comfort: ~4 h/day, with one longer explorer day OK
- Overnight: 50/50 scenic / campsite
- Last night: campsite near Tromsø (return buffer)
