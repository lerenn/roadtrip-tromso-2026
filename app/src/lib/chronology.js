/**
 * Build day chronology steps from itinerary.json.
 * Mandatory steps own the clock; optionals are inserted without shifting must times.
 */

const STOP_DURATION_H = {
  depot: 0.75,
  shop: 0.75,
  viewpoint: 0.5,
  ferry: null,
  sleep: 0.0,
  start: 0.0,
  via: 0.15,
}

function parseDate(day) {
  const [y, m, d] = day.date.split('-').map(Number)
  return new Date(y, m - 1, d, 0, 0, 0, 0)
}

function fmtDate(day) {
  const d = parseDate(day)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${day.weekday} ${dd}/${mm}/${d.getFullYear()}`
}

export function fmtDuration(hours) {
  if (hours == null) return '?'
  if (hours <= 0) return '—'
  const totalMin = Math.round(hours * 60)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h && m) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  if (h) return `${String(h).padStart(2, '0')}:00`
  return `00:${String(m).padStart(2, '0')}`
}

export function fmtTime(t) {
  if (!t) return '?'
  return `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`
}

function addHours(t, hours) {
  return new Date(t.getTime() + Math.round(hours * 60) * 60_000)
}

function dayStartClock(day) {
  const base = parseDate(day)
  if (day.day === 1) {
    base.setHours(15, 30, 0, 0)
    return base
  }
  const ferry = day.ferry || {}
  const target = ferry.target_departure
  if (target && (ferry.route || '').includes('Brensholmen')) {
    const [hh, mm] = target.split(':').map(Number)
    base.setHours(hh, mm, 0, 0)
    return addHours(base, -0.5)
  }
  if (target && (ferry.route || '').includes('Gryllefjord')) {
    const [hh, mm] = target.split(':').map(Number)
    base.setHours(Math.max(0, hh - 2), mm, 0, 0)
    return base
  }
  if (day.day === 8) {
    base.setHours(9, 0, 0, 0)
    return base
  }
  base.setHours(8, 30, 0, 0)
  return base
}

function driveLegs(day) {
  const wps = day.waypoints
  const nLegs = Math.max(wps.length - 1, 1)
  const weights = []
  for (let i = 0; i < wps.length - 1; i++) {
    const a = wps[i]
    const b = wps[i + 1]
    if (a.kind === 'ferry' && b.kind === 'ferry') weights.push(0)
    else if (a.kind === 'sleep' || (b.kind === 'sleep' && ['ferry', 'via'].includes(a.kind))) {
      weights.push(0.15)
    } else weights.push(1)
  }
  const sumW = weights.reduce((a, b) => a + b, 0) || nLegs
  const driveH = Number(day.drive_h_approx || 0)
  const safe = sumW === 0 ? weights.map(() => 1) : weights
  const total = safe.reduce((a, b) => a + b, 0)
  return safe.map((w) => driveH * (w / total))
}

function stopDuration(day, wp, index) {
  const kind = wp.kind || 'via'
  if (kind === 'ferry') {
    const ferry = day.ferry || {}
    if (ferry.duration_min && index === 0) return ferry.duration_min / 60 + 0.25
    if (ferry.duration_min) return 0.15
    return 0.5
  }
  if (kind === 'depot' && day.day === 1) return 1.0
  if (kind === 'depot' && day.day === 8) return 0.5
  if (kind === 'sleep') return 0
  return Number(STOP_DURATION_H[kind] ?? 0.3)
}

function activityFor(day, wp) {
  const kind = wp.kind || 'via'
  const name = wp.name
  if (kind === 'depot' && day.day === 1) return 'Pick up camper'
  if (kind === 'depot' && day.day === 8) return 'Return camper'
  if (kind === 'sleep') {
    const ov = day.overnight || {}
    return `Overnight (${ov.type || 'scenic'})`
  }
  if (kind === 'ferry') return `Ferry quay — ${name}`
  if (kind === 'viewpoint') return `Stop — ${name}`
  if (kind === 'shop') {
    const clean = name.replace(/^Grocery stop/, '').replace(/^[ ()]+|[ ()]+$/g, '')
    return clean ? `Grocery — ${clean}` : 'Grocery'
  }
  return name
}

function norm(s) {
  return (s || '').toLowerCase()
}

function placeMatches(key, place) {
  const keyN = norm(key)
  const p = norm(place)
  if (p.includes(keyN) || keyN.includes(p)) return true
  return keyN.split('/').some((part) => part.trim() && p.includes(part.trim()))
}

function findAnchor(item, placeEndTimes, steps) {
  const modeKeys = []
  if (item.during) modeKeys.push(['during', String(item.during)])
  if (item.after) modeKeys.push(['after', String(item.after)])
  if (!modeKeys.length && item.place) modeKeys.push(['after', String(item.place)])

  for (const [mode, key] of modeKeys) {
    const candidates = []
    for (const [place, endDt, idx] of placeEndTimes) {
      if (placeMatches(key, place)) candidates.push([endDt, idx, place])
    }
    if (!candidates.length) continue
    const nonSleep = candidates.filter((c) => !norm(c[2]).includes('overnight'))
    const pool = nonSleep.length ? nonSleep : candidates
    pool.sort((a, b) => a[1] - b[1])
    const [endDt, idx] = pool[0]
    if (mode === 'during') {
      return [steps[idx]?._dt || endDt, idx]
    }
    return [endDt, idx]
  }

  for (let i = placeEndTimes.length - 1; i >= 0; i--) {
    const [place, endDt, idx] = placeEndTimes[i]
    if (!norm(place).includes('overnight')) return [endDt, idx]
  }
  if (placeEndTimes.length) {
    const [, endDt, idx] = placeEndTimes[placeEndTimes.length - 1]
    return [endDt, idx]
  }
  return null
}

function remainingMustTravelH(steps, afterIdx) {
  let total = 0
  for (let i = afterIdx + 1; i < steps.length; i++) {
    const act = steps[i].activity || ''
    if (act.startsWith('Overnight') || act.startsWith('Return')) break
    if (!steps[i].must) continue
    if (act === 'Drive' || act.startsWith('Ferry') || act.startsWith('Board')) {
      total += Number(steps[i].duration_h || 0)
    }
  }
  return total
}

function eveningLimit(day) {
  const base = parseDate(day)
  base.setHours(20, 0, 0, 0)
  const ovName = (day.overnight || {}).name || ''
  if (ovName.includes('Gryllefjord')) {
    const g = parseDate(day)
    g.setHours(19, 0, 0, 0)
    return g
  }
  return base
}

function insertOptionals(day, steps, placeEndTimes, overnightDt) {
  if (!day.optional?.length) return steps

  const pending = []
  const limit = eveningLimit(day)

  for (let raw of day.optional) {
    let item = raw
    if (typeof item === 'string') {
      item = {
        activity: item,
        place: '—',
        duration_h: 1,
        notes: 'Skip if tired / weather is poor',
      }
    }
    const activity = item.activity || item.name || 'Optional activity'
    const place = item.place || '—'
    const durationH = Number(item.duration_h || 1)
    const notes = item.notes || 'Skip if tired / weather is poor'

    const anchor = findAnchor(item, placeEndTimes, steps)
    let startDt
    let insertAfter
    if (!anchor) {
      startDt = dayStartClock(day)
      insertAfter = steps.length - 1
    } else {
      ;[startDt, insertAfter] = anchor
    }

    const endDt = addHours(startDt, durationH)
    const arrival = addHours(endDt, remainingMustTravelH(steps, insertAfter))
    let softLimit = limit
    if (overnightDt && overnightDt > softLimit) softLimit = overnightDt
    let feasNotes = notes
    if (arrival > softLimit) {
      feasNotes = `${notes} · ⚠️ With this, overnight ~${fmtTime(arrival)} (aim ≤${fmtTime(limit)}) — only if you cut later stops`
    }

    pending.push([
      insertAfter,
      {
        date: '',
        activity: `Optional — ${activity}`,
        place,
        start: fmtTime(startDt),
        duration: fmtDuration(durationH),
        duration_h: durationH,
        must: false,
        notes: feasNotes,
        lat: item.lat ?? null,
        lon: item.lon ?? null,
        _dt: startDt,
        optional: true,
      },
    ])
  }

  pending.sort((a, b) => b[0] - a[0])
  for (const [insertAfter, optStep] of pending) {
    steps.splice(insertAfter + 1, 0, optStep)
  }

  steps.sort((a, b) => {
    const da = a._dt?.getTime?.() ?? 0
    const db = b._dt?.getTime?.() ?? 0
    if (da !== db) return da - db
    const ma = a.must ? 0 : 1
    const mb = b.must ? 0 : 1
    if (ma !== mb) return ma - mb
    const oa = (a.activity || '').startsWith('Optional') ? 1 : 0
    const ob = (b.activity || '').startsWith('Optional') ? 1 : 0
    if (oa !== ob) return oa - ob
    return (a.activity || '').localeCompare(b.activity || '')
  })

  return steps
}

export function buildDaySteps(day) {
  const wps = day.waypoints
  let clock = dayStartClock(day)
  const dateLabel = fmtDate(day)
  const steps = []
  const legs = driveLegs(day)
  const ferry = day.ferry || {}
  const placeEndTimes = []

  for (let i = 0; i < wps.length; i++) {
    const wp = wps[i]
    if (i > 0) {
      const driveH = legs[i - 1]
      const prev = wps[i - 1]
      if (driveH >= 0.08 && !(prev.kind === 'ferry' && wp.kind === 'ferry')) {
        let info = ''
        const legSum = legs.reduce((a, b) => a + b, 0)
        if (day.drive_km_approx && legSum > 0) {
          info = `~${Math.round(day.drive_km_approx * (driveH / legSum))} km`
        }
        steps.push({
          date: steps.length ? '' : dateLabel,
          activity: 'Drive',
          place: `${prev.name} → ${wp.name}`,
          start: fmtTime(clock),
          duration: fmtDuration(driveH),
          duration_h: driveH,
          must: true,
          notes: info,
          lat: wp.lat,
          lon: wp.lon,
          _dt: new Date(clock),
        })
        clock = addHours(clock, driveH)
      } else if (prev.kind === 'ferry' && wp.kind === 'ferry') {
        const crossH = (ferry.duration_min || 35) / 60
        steps.push({
          date: steps.length ? '' : dateLabel,
          activity: `Ferry crossing — ${ferry.route || 'ferry'}`,
          place: `${prev.name} → ${wp.name}`,
          start: fmtTime(clock),
          duration: fmtDuration(crossH),
          duration_h: crossH,
          must: true,
          notes:
            ferry.season_note ||
            ferry.note ||
            (ferry.target_departure ? `Target ${ferry.target_departure}` : ''),
          lat: wp.lat,
          lon: wp.lon,
          _dt: new Date(clock),
          ferry: true,
        })
        clock = addHours(clock, crossH)
      }
    }

    let dur = stopDuration(day, wp, i)
    const nextWp = wps[i + 1]
    let activity
    let notes = ''
    if (wp.kind === 'ferry' && nextWp?.kind === 'sleep') dur = 0.1
    if (wp.kind === 'ferry' && nextWp?.kind === 'ferry') {
      dur = 0.25
      activity = `Board ferry — ${ferry.route || wp.name}`
      if (ferry.target_departure) notes = `Target departure ${ferry.target_departure}`
      if (ferry.backup?.length) notes += `${notes ? ' · ' : ''}backup ${ferry.backup.join(', ')}`
    } else {
      activity = activityFor(day, wp)
      if (wp.kind === 'sleep') {
        const ov = day.overnight || {}
        notes = ov.name || ''
        if (ov.alt_campsite) notes += ` · alt campsite: ${ov.alt_campsite}`
        if (ov.alt_scenic) notes += ` · alt scenic: ${ov.alt_scenic}`
      } else if (wp.kind === 'viewpoint') {
        notes = 'Short stop / photos / drone if allowed'
      } else if (day.day === 1 && wp.kind === 'depot') {
        notes = 'Indie Campers · pickup 15:30 · Håndverkervegen 6'
      }
    }

    let must = ['depot', 'ferry', 'sleep'].includes(wp.kind) || i === 0
    if (wp.kind === 'viewpoint') must = false

    if (wp.kind === 'sleep') {
      steps.push({
        date: steps.length ? '' : dateLabel,
        activity,
        place: wp.name,
        start: fmtTime(clock),
        duration: '—',
        duration_h: 0,
        must: true,
        notes,
        lat: wp.lat,
        lon: wp.lon,
        _dt: new Date(clock),
        overnight: true,
        overnight_type: (day.overnight || {}).type || 'scenic',
      })
      placeEndTimes.push([wp.name, new Date(clock), steps.length - 1])
    } else if (dur > 0 || ['depot', 'ferry', 'shop', 'via', 'start'].includes(wp.kind)) {
      if (dur <= 0 && ['via', 'start'].includes(wp.kind)) dur = 0.05
      steps.push({
        date: steps.length ? '' : dateLabel,
        activity,
        place: wp.name,
        start: fmtTime(clock),
        duration: fmtDuration(dur),
        duration_h: dur,
        must,
        notes,
        lat: wp.lat,
        lon: wp.lon,
        _dt: new Date(clock),
      })
      clock = addHours(clock, dur)
      placeEndTimes.push([wp.name, new Date(clock), steps.length - 1])
    }
  }

  let overnightDt = steps.find((s) => s.activity?.startsWith('Overnight'))?._dt
  if (!overnightDt && steps.length) overnightDt = steps[steps.length - 1]._dt

  if (overnightDt && overnightDt.getHours() >= 22) {
    for (const s of steps) {
      if (s.activity?.startsWith('Overnight')) {
        s.notes = `${s.notes || ''} · ⚠️ Mandatory path already late — shorten stops if needed`.replace(
          /^ · /,
          '',
        )
      }
    }
  }

  let out = insertOptionals(day, steps, placeEndTimes, overnightDt)

  const dayNotes = (day.notes || []).map((n) => n.trim()).filter(Boolean)
  if (dayNotes.length) {
    const merged = dayNotes.join(' · ')
    let target =
      [...out].reverse().find(
        (s) => s.must && (s.activity?.startsWith('Overnight') || s.activity?.startsWith('Return')),
      ) || [...out].reverse().find((s) => s.must && s.activity)
    if (target) target.notes = target.notes ? `${target.notes} · ${merged}` : merged
  }

  out = out.map((s, idx) => {
    const { _dt, ...rest } = s
    return {
      ...rest,
      date: idx === 0 ? dateLabel : '',
      rowClass: [
        s.optional || s.activity?.startsWith('Optional') ? 'optional' : '',
        s.overnight || s.activity?.startsWith('Overnight') ? 'overnight' : '',
        s.must && !(s.optional || s.activity?.startsWith('Optional')) ? 'must' : '',
      ]
        .filter(Boolean)
        .join(' '),
    }
  })

  return out
}

export function buildOptionChronology(itinerary) {
  return itinerary.days.map((day) => ({
    number: day.day,
    title: day.title,
    weekday: day.weekday,
    date: day.date,
    dateLabel: formatDayLabel(day.date),
    driveKm: day.drive_km_approx,
    driveH: day.drive_h_approx,
    overnight: day.overnight || null,
    ferry: day.ferry || null,
    waypoints: day.waypoints || [],
    notes: day.notes || [],
    optional: day.optional || [],
    steps: buildDaySteps(day),
  }))
}

function formatDayLabel(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}
