const OSRM_BASE =
  import.meta.env.DEV
    ? '/osrm/route/v1/driving/'
    : 'https://router.project-osrm.org/route/v1/driving/'

const USER_AGENT = 'roadtrip-tromso-2026/1.0 (personal trip planner)'

function haversineM(lat1, lon1, lat2, lon2) {
  const r = 6_371_000
  const p1 = (lat1 * Math.PI) / 180
  const p2 = (lat2 * Math.PI) / 180
  const dp = ((lat2 - lat1) * Math.PI) / 180
  const dl = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2
  return 2 * r * Math.asin(Math.sqrt(a))
}

/**
 * @param {{ lat: number, lon: number, name?: string }[]} coords
 * @returns {Promise<{
 *   coordinates: number[][],
 *   distance: number,
 *   duration: number,
 *   legs: { duration: number, distance: number }[],
 * }>}
 */
async function osrmRoute(coords) {
  if (coords.length < 2) {
    return {
      coordinates: coords.map((c) => [c.lon, c.lat]),
      distance: 0,
      duration: 0,
      legs: [],
    }
  }

  const loc = coords.map((c) => `${c.lon},${c.lat}`).join(';')
  const url = `${OSRM_BASE}${loc}?overview=full&geometries=geojson&steps=false`
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) throw new Error(`OSRM ${res.status}`)
    const data = await res.json()
    if (data.code !== 'Ok') throw new Error(data.message || data.code)
    const route = data.routes[0]
    const legs = (route.legs || []).map((leg) => ({
      duration: Number(leg.duration) || 0,
      distance: Number(leg.distance) || 0,
    }))
    // Pad if API omitted legs (shouldn't happen).
    while (legs.length < coords.length - 1) {
      legs.push({ duration: 0, distance: 0 })
    }
    return {
      coordinates: route.geometry.coordinates,
      distance: route.distance,
      duration: route.duration,
      legs,
    }
  } catch (err) {
    console.warn('OSRM fallback', err)
    const coordinates = coords.map((c) => [c.lon, c.lat])
    const legs = []
    let dist = 0
    let dur = 0
    for (let i = 0; i < coords.length - 1; i++) {
      const d = haversineM(
        coords[i].lat,
        coords[i].lon,
        coords[i + 1].lat,
        coords[i + 1].lon,
      )
      // ~13 m/s ≈ 47 km/h crude fallback only when OSRM is down.
      const t = d / 13
      legs.push({ duration: t, distance: d })
      dist += d
      dur += t
    }
    return { coordinates, distance: dist, duration: dur, legs }
  }
}

/**
 * Per consecutive waypoint pair: OSRM drive stats, or null for ferry↔ferry hops.
 * @typedef {{ duration_s: number, distance_m: number, from: string, to: string } | null} DriveLegStat
 */

/**
 * Split day waypoints into drive segments (OSRM) and ferry hops (straight dashed).
 * Also returns `driveLegs` aligned 1:1 with consecutive waypoint pairs (null = ferry hop).
 */
export async function buildDayRoutes(waypoints) {
  const driveTracks = []
  const ferryTracks = []
  /** @type {DriveLegStat[]} */
  const driveLegs = []
  let segment = []

  const flushDrive = async () => {
    if (segment.length >= 2) {
      const route = await osrmRoute(segment)
      driveTracks.push(route.coordinates)
      for (let i = 0; i < segment.length - 1; i++) {
        const leg = route.legs[i] || { duration: 0, distance: 0 }
        driveLegs.push({
          duration_s: leg.duration,
          distance_m: leg.distance,
          from: segment[i].name || '',
          to: segment[i + 1].name || '',
        })
      }
    } else if (segment.length === 1) {
      driveTracks.push([[segment[0].lon, segment[0].lat]])
    }
    segment = []
  }

  for (let i = 0; i < waypoints.length; i++) {
    const wp = waypoints[i]
    const next = waypoints[i + 1]

    segment.push({
      lat: wp.lat,
      lon: wp.lon,
      kind: wp.kind,
      name: wp.name,
    })

    if (wp.kind === 'ferry' && next?.kind === 'ferry') {
      await flushDrive()
      ferryTracks.push([
        [wp.lon, wp.lat],
        [next.lon, next.lat],
      ])
      driveLegs.push(null) // ferry crossing — not an OSRM drive
      segment = []
    }
  }
  await flushDrive()

  const driveOnly = driveLegs.filter(Boolean)
  const totalDistanceM = driveOnly.reduce((s, l) => s + l.distance_m, 0)
  const totalDurationS = driveOnly.reduce((s, l) => s + l.duration_s, 0)

  return {
    driveTracks,
    ferryTracks,
    driveLegs,
    totalDistanceM,
    totalDurationS,
  }
}

export async function buildOverviewRoutes(days) {
  const driveTracks = []
  const ferryTracks = []
  for (const day of days) {
    const { driveTracks: d, ferryTracks: f } = await buildDayRoutes(
      day.waypoints || [],
    )
    driveTracks.push(...d)
    ferryTracks.push(...f)
  }
  return { driveTracks, ferryTracks }
}

export function waypointsForMap(waypoints) {
  return (waypoints || []).map((wp) => ({
    name: wp.name,
    kind: wp.kind || 'via',
    lat: wp.lat,
    lon: wp.lon,
    optional: Boolean(wp.optional),
  }))
}

export { USER_AGENT }
