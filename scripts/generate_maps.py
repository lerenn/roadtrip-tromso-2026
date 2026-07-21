#!/usr/bin/env python3
"""Generate overview + per-day PNG maps and GPX tracks from itinerary.json files."""

from __future__ import annotations

import json
import math
import time
import urllib.request
from pathlib import Path

import contextily as cx
import matplotlib.pyplot as plt
from matplotlib.lines import Line2D
from pyproj import Transformer
from rasterio.enums import Resampling

ROOT = Path(__file__).resolve().parents[1]
OSRM = "https://router.project-osrm.org/route/v1/driving/"
USER_AGENT = "roadtrip-tromso-2026/1.0 (personal trip planner)"
TO_3857 = Transformer.from_crs("EPSG:4326", "EPSG:3857", always_xy=True)
BASEMAP = cx.providers.OpenStreetMap.Mapnik

# High-res export: larger canvas + sharper tiles (zoom_adjust pulls finer OSM tiles)
FIGSIZE = (12.5, 13.5)
DPI = 280
BASEMAP_ZOOM_ADJUST = 1  # +1 zoom level vs auto → ~2× tile resolution
BASEMAP_RESAMPLING = Resampling.lanczos

KIND_STYLE = {
    "depot": ("#c0392b", "D"),
    "sleep": ("#2980b9", "N"),  # fallback
    "sleep_scenic": ("#e67e22", "N"),  # non-campsite / beautiful spot
    "sleep_campsite": ("#2980b9", "N"),  # campsite with facilities
    "ferry": ("#8e44ad", "F"),
    "viewpoint": ("#27ae60", "V"),
    "shop": ("#f39c12", "S"),
    "start": ("#34495e", "•"),
    "via": ("#7f8c8d", "•"),
}

KIND_PRIORITY = {
    "depot": 0,
    "sleep_scenic": 1,
    "sleep_campsite": 1,
    "sleep": 1,
    "ferry": 2,
    "viewpoint": 3,
    "shop": 4,
    "start": 5,
    "via": 6,
}


def to_mercator(lon: float, lat: float) -> tuple[float, float]:
    return TO_3857.transform(lon, lat)


def track_to_mercator(track: list[tuple[float, float]]) -> tuple[list[float], list[float]]:
    xs, ys = [], []
    for lon, lat in track:
        x, y = to_mercator(lon, lat)
        xs.append(x)
        ys.append(y)
    return xs, ys


def short_label(name: str, max_len: int = 32) -> str:
    name = name.strip()
    if len(name) <= max_len:
        return name
    return name[: max_len - 1].rstrip() + "…"


def dedupe_waypoints(
    waypoints: list[dict],
    min_sep_m: float = 350.0,
) -> list[tuple[int, dict, float, float]]:
    """Drop near-duplicate markers of the same kind; keep higher-priority otherwise."""
    kept: list[tuple[int, dict, float, float]] = []
    for i, wp in enumerate(waypoints, start=1):
        x, y = to_mercator(wp["lon"], wp["lat"])
        collide_at = None
        for j, (_idx, other, ox, oy) in enumerate(kept):
            dist = math.hypot(x - ox, y - oy)
            same_kind = wp.get("kind") == other.get("kind")
            # Always collapse almost-identical points; only same-kind at larger separation
            if dist < 120.0 or (same_kind and dist < min_sep_m):
                collide_at = j
                break
        if collide_at is None:
            kept.append((i, wp, x, y))
            continue
        _idx, other, ox, oy = kept[collide_at]
        p_new = KIND_PRIORITY.get(wp.get("kind", "via"), 99)
        p_old = KIND_PRIORITY.get(other.get("kind", "via"), 99)
        if p_new < p_old:
            kept[collide_at] = (i, wp, x, y)
    return kept


def _bboxes_overlap(
    a: tuple[float, float, float, float],
    b: tuple[float, float, float, float],
    pad: float = 4.0,
) -> bool:
    ax0, ay0, ax1, ay1 = a
    bx0, by0, bx1, by1 = b
    return not (
        ax1 + pad < bx0
        or bx1 + pad < ax0
        or ay1 + pad < by0
        or by1 + pad < ay0
    )


def _estimate_label_bbox(cx_: float, cy_: float, text: str, fontsize: float = 7.2) -> tuple[float, float, float, float]:
    """Approximate label bbox in display pixels (avoids redrawing for every candidate)."""
    w = len(text) * fontsize * 0.55 + 14
    h = fontsize * 1.7 + 8
    return (cx_ - w / 2, cy_ - h / 2, cx_ + w / 2, cy_ + h / 2)


def place_labels(ax, labeled: list[tuple[int, dict, float, float]], span: float) -> None:
    """Place callout labels with collision checks in display coordinates."""
    fig = ax.figure
    fig.canvas.draw()
    renderer = fig.canvas.get_renderer()

    occupied: list[tuple[float, float, float, float]] = []

    legend = ax.get_legend()
    if legend is not None:
        bbox = legend.get_window_extent(renderer=renderer)
        occupied.append((bbox.x0 - 4, bbox.y0 - 4, bbox.x1 + 4, bbox.y1 + 4))

    for artist in ax.texts:
        try:
            bbox = artist.get_window_extent(renderer=renderer)
            occupied.append((bbox.x0 - 2, bbox.y0 - 2, bbox.x1 + 2, bbox.y1 + 2))
        except Exception:  # noqa: BLE001
            pass

    for _idx, _wp, x, y in labeled:
        dx, dy = ax.transData.transform((x, y))
        r = 14
        occupied.append((dx - r, dy - r, dx + r, dy + r))

    xlim = ax.get_xlim()
    ylim = ax.get_ylim()
    ax_bb = ax.get_window_extent(renderer=renderer)
    radii_pts = [26, 40, 56, 74, 94, 116, 140]
    angles = list(range(0, 360, 20))

    for n, (idx, wp, x, y) in enumerate(labeled):
        color, _mark = KIND_STYLE.get(wp.get("kind", "via"), ("#555", "•"))
        ax.scatter(x, y, s=90, c=color, zorder=5, edgecolors="white", linewidths=1.2)

        label = f"{idx}. {short_label(wp['name'])}"
        px, py = ax.transData.transform((x, y))
        placed = False
        start = (n * 53) % 360
        ordered_angles = [((start + a) % 360) for a in angles]

        for radius in radii_pts:
            for deg in ordered_angles:
                rad = math.radians(deg)
                tx = px + radius * math.cos(rad)
                ty = py + radius * math.sin(rad)
                data_x, data_y = ax.transData.inverted().transform((tx, ty))
                if not (xlim[0] < data_x < xlim[1] and ylim[0] < data_y < ylim[1]):
                    continue

                bb = _estimate_label_bbox(tx, ty, label)
                if (
                    bb[0] < ax_bb.x0 + 4
                    or bb[1] < ax_bb.y0 + 4
                    or bb[2] > ax_bb.x1 - 4
                    or bb[3] > ax_bb.y1 - 4
                ):
                    continue
                if any(_bboxes_overlap(bb, other, pad=5.0) for other in occupied):
                    continue

                ax.text(
                    data_x,
                    data_y,
                    label,
                    fontsize=7.2,
                    color="#1c2833",
                    zorder=6,
                    ha="center",
                    va="center",
                    bbox=dict(boxstyle="round,pad=0.28", fc="white", ec="#b0b0b0", alpha=0.92),
                )
                ax.plot(
                    [x, data_x],
                    [y, data_y],
                    color="#5d6d7e",
                    linewidth=0.7,
                    alpha=0.85,
                    zorder=4,
                    solid_capstyle="round",
                )
                occupied.append(bb)
                placed = True
                break
            if placed:
                break

        if not placed:
            # Side panel fallback: stack leftover labels on the right edge
            data_x = xlim[1] - (xlim[1] - xlim[0]) * 0.02
            data_y = ylim[1] - (ylim[1] - ylim[0]) * (0.12 + 0.06 * n)
            ax.text(
                data_x,
                data_y,
                label,
                fontsize=7.0,
                color="#1c2833",
                zorder=6,
                ha="right",
                va="center",
                bbox=dict(boxstyle="round,pad=0.28", fc="white", ec="#b0b0b0", alpha=0.92),
            )
            ax.plot([x, data_x], [y, data_y], color="#5d6d7e", linewidth=0.7, alpha=0.7, zorder=4)


def http_get_json(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode())


def osrm_route(coords: list[tuple[float, float]]) -> tuple[list[tuple[float, float]], float, float]:
    """Return (lon,lat) path, distance_m, duration_s. Falls back to straight segments."""
    if len(coords) < 2:
        return [(c[1], c[0]) for c in coords], 0.0, 0.0

    loc = ";".join(f"{lon},{lat}" for lat, lon in coords)
    url = OSRM + loc + "?overview=full&geometries=geojson&steps=false"
    try:
        data = http_get_json(url)
        if data.get("code") != "Ok":
            raise RuntimeError(data.get("message", data.get("code")))
        route = data["routes"][0]
        path = [(p[0], p[1]) for p in route["geometry"]["coordinates"]]
        return path, float(route["distance"]), float(route["duration"])
    except Exception as exc:  # noqa: BLE001
        print(f"  OSRM fallback ({exc})")
        path = [(lon, lat) for lat, lon in coords]
        dist = 0.0
        for (lat1, lon1), (lat2, lon2) in zip(coords, coords[1:]):
            dist += haversine_m(lat1, lon1, lat2, lon2)
        return path, dist, dist / 13.0


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def write_gpx(path: Path, name: str, track: list[tuple[float, float]], waypoints: list[dict]) -> None:
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<gpx version="1.1" creator="roadtrip-tromso-2026"',
        ' xmlns="http://www.topografix.com/GPX/1/1">',
        f"  <metadata><name>{_xml(name)}</name></metadata>",
    ]
    for wp in waypoints:
        lines.append(
            f'  <wpt lat="{wp["lat"]:.6f}" lon="{wp["lon"]:.6f}">'
            f"<name>{_xml(wp['name'])}</name>"
            f"<type>{_xml(wp.get('kind', 'poi'))}</type></wpt>"
        )
    lines.append(f"  <trk><name>{_xml(name)}</name><trkseg>")
    for lon, lat in track:
        lines.append(f'    <trkpt lat="{lat:.6f}" lon="{lon:.6f}"></trkpt>')
    lines.append("  </trkseg></trk></gpx>")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def _xml(s: str) -> str:
    return (
        s.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def plot_map(
    out_png: Path,
    title: str,
    drive_tracks: list[list[tuple[float, float]]],
    ferry_tracks: list[list[tuple[float, float]]],
    waypoints: list[dict],
    subtitle: str = "",
) -> None:
    fig, ax = plt.subplots(figsize=FIGSIZE, dpi=DPI)
    fig.patch.set_facecolor("#f7f5f0")
    ax.set_facecolor("#dce6ef")

    for track in drive_tracks:
        if not track:
            continue
        xs, ys = track_to_mercator(track)
        ax.plot(xs, ys, color="white", linewidth=5.0, solid_capstyle="round", zorder=2, alpha=0.9)
        ax.plot(xs, ys, color="#c0392b", linewidth=2.4, solid_capstyle="round", zorder=3)

    for track in ferry_tracks:
        if len(track) < 2:
            continue
        xs, ys = track_to_mercator(track)
        ax.plot(xs, ys, color="white", linewidth=4.5, linestyle="--", solid_capstyle="round", zorder=3, alpha=0.9)
        ax.plot(
            xs,
            ys,
            color="#6c3483",
            linewidth=2.2,
            linestyle="--",
            solid_capstyle="round",
            zorder=4,
        )

    all_xy: list[tuple[float, float]] = [to_mercator(wp["lon"], wp["lat"]) for wp in waypoints]
    for track in drive_tracks + ferry_tracks:
        all_xy.extend(to_mercator(lon, lat) for lon, lat in track)

    if all_xy:
        xs = [p[0] for p in all_xy]
        ys = [p[1] for p in all_xy]
        span_x = max(xs) - min(xs)
        span_y = max(ys) - min(ys)
        span = max(span_x, span_y, 1.0)
        pad_x = max(2500.0, span_x * 0.16)
        pad_y = max(2500.0, span_y * 0.16)
        ax.set_xlim(min(xs) - pad_x, max(xs) + pad_x * 1.25)
        ax.set_ylim(min(ys) - pad_y, max(ys) + pad_y * 1.25)
    else:
        span = 10000.0

    ax.set_aspect("equal")
    ax.set_axis_off()

    try:
        # zoom_adjust=+1 fetches finer tiles so high-DPI exports stay sharp
        # instead of upscaling coarse auto-zoom tiles.
        cx.add_basemap(
            ax,
            source=BASEMAP,
            crs="EPSG:3857",
            attribution=False,
            zorder=0,
            zoom="auto",
            zoom_adjust=BASEMAP_ZOOM_ADJUST,
            resampling=BASEMAP_RESAMPLING,
            interpolation="lanczos",
        )
    except Exception as exc:  # noqa: BLE001
        print(f"  basemap warning ({exc}) — retrying without zoom boost")
        try:
            cx.add_basemap(ax, source=BASEMAP, crs="EPSG:3857", attribution=False, zorder=0)
        except Exception as exc2:  # noqa: BLE001
            print(f"  basemap warning ({exc2}) — saving without tiles")

    ax.set_title(title, fontsize=14, fontweight="bold", pad=14, color="#1c2833")
    if subtitle:
        ax.text(
            0.5,
            1.015,
            subtitle,
            transform=ax.transAxes,
            ha="center",
            va="bottom",
            fontsize=9,
            color="#566573",
        )

    legend_items = [
        Line2D([0], [0], color="#c0392b", lw=2.4, label="Driving route (OSRM)"),
        Line2D([0], [0], color="#6c3483", lw=2.2, linestyle="--", label="Ferry (direct)"),
        Line2D([0], [0], marker="o", color="w", markerfacecolor="#c0392b", markersize=8, label="Depot"),
        Line2D(
            [0],
            [0],
            marker="o",
            color="w",
            markerfacecolor="#e67e22",
            markersize=8,
            label="Overnight (scenic / non-campsite)",
        ),
        Line2D(
            [0],
            [0],
            marker="o",
            color="w",
            markerfacecolor="#2980b9",
            markersize=8,
            label="Overnight (campsite)",
        ),
        Line2D([0], [0], marker="o", color="w", markerfacecolor="#8e44ad", markersize=8, label="Ferry quay"),
        Line2D([0], [0], marker="o", color="w", markerfacecolor="#27ae60", markersize=8, label="Viewpoint"),
    ]
    ax.legend(
        handles=legend_items,
        loc="upper left",
        bbox_to_anchor=(0.01, 0.99),
        framealpha=0.94,
        fontsize=7.5,
        borderpad=0.5,
    )

    ax.annotate(
        "N",
        xy=(0.96, 0.12),
        xytext=(0.96, 0.04),
        xycoords="axes fraction",
        textcoords="axes fraction",
        arrowprops=dict(arrowstyle="->", color="#1c2833"),
        ha="center",
        fontsize=10,
        fontweight="bold",
        zorder=7,
    )

    ax.text(
        0.99,
        0.01,
        "Basemap © OpenStreetMap · roads via OSRM · ferries dashed",
        transform=ax.transAxes,
        fontsize=6.5,
        color="#566573",
        ha="right",
        va="bottom",
        zorder=8,
        bbox=dict(boxstyle="round,pad=0.25", fc="white", ec="#bdc3c7", alpha=0.9),
    )

    fig.tight_layout()

    min_sep = max(300.0, min(2800.0, span * 0.03))
    labeled = dedupe_waypoints(waypoints, min_sep_m=min_sep)
    place_labels(ax, labeled, span)

    out_png.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(
        out_png,
        dpi=DPI,
        bbox_inches="tight",
        facecolor=fig.get_facecolor(),
        pad_inches=0.15,
    )
    plt.close(fig)
    print(f"  wrote {out_png.relative_to(ROOT)}")


def overnight_kind(overnight: dict | None) -> str:
    if not overnight:
        return "sleep"
    if overnight.get("type") == "campsite":
        return "sleep_campsite"
    return "sleep_scenic"


def apply_overnight_kinds(waypoints: list[dict], overnight: dict | None) -> list[dict]:
    """Copy waypoints and tag sleep markers as scenic vs campsite."""
    kind = overnight_kind(overnight)
    out = []
    for wp in waypoints:
        wp = dict(wp)
        if wp.get("kind") == "sleep":
            wp["kind"] = kind
        out.append(wp)
    return out


def is_ferry_hop(a: dict, b: dict) -> bool:
    """True when consecutive waypoints should be a water crossing, not a road."""
    if a.get("kind") == "ferry" and b.get("kind") == "ferry":
        return True
    names = {a["name"].lower(), b["name"].lower()}
    pairs = [
        {"brensholmen ferry", "botnhamn"},
        {"brensholmen", "botnhamn"},
        {"gryllefjord ferry", "andenes ferry"},
        {"breivikeidet ferry", "svensby"},
        {"svensby", "breivikeidet"},
        {"breivikeidet", "svensby"},
        {"lyngseidet ferry", "olderdalen"},
        {"olderdalen ferry", "lyngseidet"},
        {"olderdalen", "lyngseidet ferry"},
        {"lyngseidet", "olderdalen"},
    ]
    return any(names == pair for pair in pairs)


def route_day(
    waypoints: list[dict],
) -> tuple[list[list[tuple[float, float]]], list[list[tuple[float, float]]], float, float]:
    """Split itinerary into driving segments + ferry hops."""
    drive_tracks: list[list[tuple[float, float]]] = []
    ferry_tracks: list[list[tuple[float, float]]] = []
    total_m = 0.0
    total_s = 0.0

    if not waypoints:
        return drive_tracks, ferry_tracks, total_m, total_s

    segment: list[dict] = [waypoints[0]]
    for prev, cur in zip(waypoints, waypoints[1:]):
        if is_ferry_hop(prev, cur):
            if len(segment) >= 2:
                coords = [(wp["lat"], wp["lon"]) for wp in segment]
                track, dist_m, dur_s = osrm_route(coords)
                drive_tracks.append(track)
                total_m += dist_m
                total_s += dur_s
                time.sleep(0.35)
            ferry_tracks.append([(prev["lon"], prev["lat"]), (cur["lon"], cur["lat"])])
            total_m += haversine_m(prev["lat"], prev["lon"], cur["lat"], cur["lon"])
            segment = [cur]
        else:
            segment.append(cur)

    if len(segment) >= 2:
        coords = [(wp["lat"], wp["lon"]) for wp in segment]
        track, dist_m, dur_s = osrm_route(coords)
        drive_tracks.append(track)
        total_m += dist_m
        total_s += dur_s
        time.sleep(0.35)
    elif len(segment) == 1 and not drive_tracks and not ferry_tracks:
        wp = segment[0]
        drive_tracks.append([(wp["lon"], wp["lat"])])

    return drive_tracks, ferry_tracks, total_m, total_s


def flatten_tracks(tracks: list[list[tuple[float, float]]]) -> list[tuple[float, float]]:
    out: list[tuple[float, float]] = []
    for track in tracks:
        out.extend(track)
    return out


def generate_option(option_dir: Path) -> None:
    itinerary = json.loads((option_dir / "itinerary.json").read_text())
    maps_dir = option_dir / "maps"
    maps_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n=== Option {itinerary['id']}: {itinerary['title']} ===")

    overview_drive: list[list[tuple[float, float]]] = []
    overview_ferry: list[list[tuple[float, float]]] = []

    for day in itinerary["days"]:
        wps = apply_overnight_kinds(day["waypoints"], day.get("overnight"))
        print(f"Day {day['day']}: routing {len(wps)} points…")
        drive_tracks, ferry_tracks, dist_m, dur_s = route_day(wps)

        slug = f"day-{day['day']:02d}"
        title = f"Option {itinerary['id']} · Day {day['day']} · {day['title']}"
        subtitle = (
            f"{day['weekday']} {day['date']} · "
            f"~{day['drive_km_approx']} km planned · "
            f"routed {dist_m/1000:.0f} km / {dur_s/3600:.1f} h"
        )
        plot_map(maps_dir / f"{slug}.png", title, drive_tracks, ferry_tracks, wps, subtitle)
        write_gpx(
            maps_dir / f"{slug}.gpx",
            title,
            flatten_tracks(drive_tracks) + flatten_tracks(ferry_tracks),
            wps,
        )

        overview_drive.extend(drive_tracks)
        overview_ferry.extend(ferry_tracks)

    overnight_wps = []
    for day in itinerary["days"]:
        ov = day.get("overnight")
        if ov:
            overnight_wps.append(
                {
                    "name": f"N{day['day']}: {ov['name']}",
                    "lat": ov["lat"],
                    "lon": ov["lon"],
                    "kind": overnight_kind(ov),
                }
            )

    plot_map(
        maps_dir / "overview.png",
        f"Option {itinerary['id']} · {itinerary['title']} · Overview",
        overview_drive,
        overview_ferry,
        overnight_wps
        + [
            {
                "name": "Indie Campers Tromsø",
                "lat": 69.6730,
                "lon": 18.9865,
                "kind": "depot",
            }
        ],
        itinerary.get("tagline", ""),
    )
    write_gpx(
        maps_dir / "overview.gpx",
        f"Option {itinerary['id']} overview",
        flatten_tracks(overview_drive) + flatten_tracks(overview_ferry),
        overnight_wps,
    )


def main() -> None:
    for name in ("option-a-senja-vesteralen", "option-b-senja-lyngen"):
        generate_option(ROOT / name)
    print("\nDone.")


if __name__ == "__main__":
    main()
