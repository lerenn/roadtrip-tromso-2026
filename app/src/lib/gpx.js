export function trackToGpx(name, driveTracks, ferryTracks, waypoints) {
  const esc = (s) =>
    String(s)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')

  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="roadtrip-tromso-2026"',
    ' xmlns="http://www.topografix.com/GPX/1/1">',
    `  <metadata><name>${esc(name)}</name></metadata>`,
  ]

  for (const wp of waypoints || []) {
    if (wp.lat == null || wp.lon == null) continue
    lines.push(
      `  <wpt lat="${wp.lat.toFixed(6)}" lon="${wp.lon.toFixed(6)}"><name>${esc(wp.name)}</name><type>${esc(wp.kind || 'poi')}</type></wpt>`,
    )
  }

  const all = [...(driveTracks || []), ...(ferryTracks || [])]
  all.forEach((track, i) => {
    if (!track?.length) return
    lines.push(`  <trk><name>${esc(`${name} · segment ${i + 1}`)}</name><trkseg>`)
    for (const [lon, lat] of track) {
      lines.push(`    <trkpt lat="${lat.toFixed(6)}" lon="${lon.toFixed(6)}"></trkpt>`)
    }
    lines.push('  </trkseg></trk>')
  })

  lines.push('</gpx>')
  return lines.join('\n') + '\n'
}

export function downloadText(filename, text, mime = 'application/gpx+xml') {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
