#!/usr/bin/env python3
"""Render one English markdown file per day from itinerary.json."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def md_day(option_id: str, day: dict) -> str:
    ov = day.get("overnight")
    lines = [
        f"# Day {day['day']} — {day['title']}",
        "",
        f"**{day['weekday']} {day['date']}** · Option {option_id}",
        "",
        f"- Approximate driving: **~{day['drive_km_approx']} km / {day['drive_h_approx']} h** (stops extra)",
    ]
    if ov:
        lines.append(
            f"- Overnight: **{ov['name']}** ({ov['type']})"
            + (f" — alt: {ov['alt_campsite']}" if ov.get("alt_campsite") else "")
            + (f" — alt: {ov['alt_scenic']}" if ov.get("alt_scenic") else "")
        )
    else:
        lines.append("- Overnight: — (return day)")

    lines += ["", "## Map", ""]
    slug = f"day-{day['day']:02d}"
    lines.append(f"![Day {day['day']} map](../maps/{slug}.png)")
    lines.append("")
    lines.append(f"GPX: [`maps/{slug}.gpx`](../maps/{slug}.gpx)")
    lines.append("")

    if day.get("ferry"):
        f = day["ferry"]
        lines += ["## Ferry", ""]
        lines.append(f"- Route: **{f.get('route', '')}**")
        if f.get("duration_min"):
            lines.append(f"- Duration: ~{f['duration_min']} min")
        if f.get("target_departure"):
            lines.append(f"- Target departure: **{f['target_departure']}**")
        if f.get("backup"):
            lines.append(f"- Backup sailings: {', '.join(f['backup'])}")
        if f.get("sunday_from_brensholmen"):
            lines.append(
                "- Sunday from Brensholmen: "
                + ", ".join(f["sunday_from_brensholmen"])
            )
        if f.get("season_note"):
            lines.append(f"- Note: {f['season_note']}")
        if f.get("note"):
            lines.append(f"- Note: {f['note']}")
        if f.get("source"):
            lines.append(f"- Source: {f['source']}")
        lines.append("")

    lines += ["## Stops", ""]
    for i, wp in enumerate(day["waypoints"], start=1):
        lines.append(
            f"{i}. **{wp['name']}** ({wp.get('kind', 'poi')}) — "
            f"`{wp['lat']:.5f}, {wp['lon']:.5f}`"
        )
    lines.append("")

    if day.get("optional"):
        lines += ["## Optional", ""]
        for item in day["optional"]:
            lines.append(f"- {item}")
        lines.append("")

    if day.get("notes"):
        lines += ["## Notes", ""]
        for n in day["notes"]:
            lines.append(f"- {n}")
        lines.append("")

    lines += [
        "## Camper logistics",
        "",
        "- Prefer **campsite nights** for showers, laundry, fresh water, and dump.",
        "- On **scenic nights**, use legal pull-offs: no private land, leave no trace, "
        "keep distance from houses (allemannsretten).",
        "- Fuel when you see a station — remote stretches have gaps.",
        "",
    ]
    return "\n".join(lines)


def write_option(option_dir: Path) -> None:
    itinerary = json.loads((option_dir / "itinerary.json").read_text())
    days_dir = option_dir / "days"
    days_dir.mkdir(parents=True, exist_ok=True)

    nights = []
    for day in itinerary["days"]:
        text = md_day(itinerary["id"], day)
        path = days_dir / f"day-{day['day']:02d}.md"
        path.write_text(text, encoding="utf-8")
        print(f"  {path.relative_to(ROOT)}")
        if day.get("overnight"):
            nights.append((day["day"], day["overnight"]))

    # option README
    lines = [
        f"# Option {itinerary['id']} — {itinerary['title']}",
        "",
        itinerary["tagline"],
        "",
        "## Anchors",
        "",
    ]
    for a in itinerary["anchors"]:
        lines.append(f"- {a}")
    lines += [
        "",
        "## Overnight mix",
        "",
        f"- Scenic: **{itinerary['nights_summary']['scenic']}**",
        f"- Campsite: **{itinerary['nights_summary']['campsite']}**",
        f"- Rule: {itinerary['nights_summary']['rule']}",
        "",
        "| Night | Date → | Place | Type |",
        "| --- | --- | --- | --- |",
    ]
    dates = [d["date"] for d in itinerary["days"] if d.get("overnight")]
    for (n, ov), date in zip(nights, dates):
        lines.append(f"| {n} | {date} | {ov['name']} | {ov['type']} |")

    lines += [
        "",
        "## Overview map",
        "",
        "![Overview](maps/overview.png)",
        "",
        "GPX: [`maps/overview.gpx`](maps/overview.gpx)",
        "",
        "## Days",
        "",
    ]
    for day in itinerary["days"]:
        lines.append(
            f"- [Day {day['day']}: {day['title']}](days/day-{day['day']:02d}.md) "
            f"({day['weekday']} {day['date']})"
        )
    lines += [
        "",
        "## Regenerate maps",
        "",
        "```bash",
        "python3 scripts/generate_maps.py",
        "python3 scripts/generate_days.py",
        "```",
        "",
    ]
    (option_dir / "README.md").write_text("\n".join(lines), encoding="utf-8")
    print(f"  { (option_dir / 'README.md').relative_to(ROOT) }")


def main() -> None:
    for name in ("option-a-senja-vesteralen", "option-b-senja-lyngen"):
        print(f"Option dir {name}")
        write_option(ROOT / name)


if __name__ == "__main__":
    main()
