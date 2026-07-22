/**
 * Civil sunrise / sunset for a calendar day at lat/lon.
 * Times are Europe/Oslo wall-clock (trip timezone) for timeline ordering.
 *
 * Algorithm adapted from SunCalc (Vladimir Agafonkin), MIT.
 */

const OSLO = 'Europe/Oslo'
const DEG = Math.PI / 180
const J0 = 0.0009
const J1970 = 2440588
const J2000 = 2451545
const dayMs = 1000 * 60 * 60 * 24

function toJulian(date) {
  return date.valueOf() / dayMs - 0.5 + J1970
}

function fromJulian(j) {
  return new Date((j + 0.5 - J1970) * dayMs)
}

function julianCycle(d, lw) {
  return Math.round(d - J0 - lw / (2 * Math.PI))
}

function approxTransit(Ht, lw, n) {
  return J0 + (Ht + lw) / (2 * Math.PI) + n
}

function solarMeanAnomaly(d) {
  return DEG * (357.5291 + 0.98560028 * d)
}

function eclipticLongitude(M) {
  const C =
    DEG *
    (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M))
  const P = DEG * 102.9372
  return M + C + P + Math.PI
}

function declination(L) {
  return Math.asin(Math.sin(L) * Math.sin(DEG * 23.4397))
}

function julianSolarTransit(ds, M, L) {
  return J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L)
}

function hourAngle(h, phi, dec) {
  return Math.acos(
    (Math.sin(h) - Math.sin(phi) * Math.sin(dec)) /
      (Math.cos(phi) * Math.cos(dec)),
  )
}

/**
 * @returns {{ sunrise: Date|null, sunset: Date|null }}
 */
export function sunTimesUTC(isoDate, lat, lon) {
  const [y, m, d] = String(isoDate).split('-').map(Number)
  if (!Number.isFinite(y) || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    return { sunrise: null, sunset: null }
  }

  const lw = DEG * -lon
  const phi = DEG * lat
  const date = new Date(Date.UTC(y, m - 1, d, 0, 0, 0))
  const d0 = toJulian(date) - J2000
  const n = julianCycle(d0, lw)
  const ds = approxTransit(0, lw, n)
  const M = solarMeanAnomaly(ds)
  const L = eclipticLongitude(M)
  const dec = declination(L)
  const Jnoon = julianSolarTransit(ds, M, L)

  const h0 = DEG * -0.833
  const cosH =
    (Math.sin(h0) - Math.sin(phi) * Math.sin(dec)) /
    (Math.cos(phi) * Math.cos(dec))

  // Polar night / midnight sun — no distinct rise/set that day
  if (cosH > 1 || cosH < -1 || Number.isNaN(cosH)) {
    return { sunrise: null, sunset: null }
  }

  const w = Math.acos(cosH)
  const a = approxTransit(w, lw, n)
  const Jset = julianSolarTransit(a, M, L)
  const Jrise = Jnoon - (Jset - Jnoon)

  return {
    sunrise: fromJulian(Jrise),
    sunset: fromJulian(Jset),
  }
}

function formatOsloHM(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: OSLO,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const hh = parts.find((p) => p.type === 'hour')?.value
  const mm = parts.find((p) => p.type === 'minute')?.value
  if (hh == null || mm == null) return null
  // en-GB can yield "24" for midnight in some engines — normalize
  const hNum = Number(hh) % 24
  return `${String(hNum).padStart(2, '0')}:${mm}`
}

/** Representative lat/lon: overnight preferred, else waypoint mean, else Tromsø. */
export function daySunLocation(day) {
  const ov = day?.overnight
  if (ov?.lat != null && ov?.lon != null) {
    return {
      lat: Number(ov.lat),
      lon: Number(ov.lon),
      label: ov.name || 'overnight',
    }
  }
  const wps = (day?.waypoints || []).filter((w) => w.lat != null && w.lon != null)
  if (wps.length) {
    const lat = wps.reduce((s, w) => s + Number(w.lat), 0) / wps.length
    const lon = wps.reduce((s, w) => s + Number(w.lon), 0) / wps.length
    return { lat, lon, label: 'day route' }
  }
  return { lat: 69.6496, lon: 18.956, label: 'Tromsø' }
}

export function daySunClock(day) {
  const { lat, lon, label } = daySunLocation(day)
  const { sunrise, sunset } = sunTimesUTC(day?.date, lat, lon)
  return {
    sunrise: formatOsloHM(sunrise),
    sunset: formatOsloHM(sunset),
    lat,
    lon,
    label,
  }
}

/**
 * Dates on the same calendar basis as chronology steps (local Date + Oslo HM),
 * so markers sort correctly against step startMs.
 */
export function sunMarkerDates(day) {
  const clock = daySunClock(day)
  const [y, m, d] = String(day.date).split('-').map(Number)
  const toLocal = (hm) => {
    if (!hm) return null
    const [hh, mm] = hm.split(':').map(Number)
    if (!Number.isFinite(hh)) return null
    return new Date(y, m - 1, d, hh, mm || 0, 0, 0)
  }
  return {
    ...clock,
    sunriseAt: toLocal(clock.sunrise),
    sunsetAt: toLocal(clock.sunset),
  }
}
