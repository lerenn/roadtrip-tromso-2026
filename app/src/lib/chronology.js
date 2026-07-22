/**
 * Build day chronology steps from itinerary.json.
 * Mandatory steps own the baseline clock; optionals are inserted at anchor times
 * without shifting later steps. Selecting optionals in the UI piles their
 * durations onto following start times.
 * Meals (breakfast/lunch/dinner) are interlines that consume time on the clock
 * but do not set the optional `*` shift marker; sunrise/sunset are markers only
 * (see insertMealInterlines / insertSunInterlines).
 */

import { sunMarkerDates } from './sun.js'
import depot from '../../../shared/depot.json' with { type: 'json' }

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

/** Wall-clock appointment on `day` from depot ISO (`pickup` / `return`). */
function depotAppointment(day, which) {
  const iso = depot?.[which]
  const m = String(iso || '').match(/T(\d{2}):(\d{2})/)
  const base = parseDate(day)
  if (m) {
    base.setHours(Number(m[1]), Number(m[2]), 0, 0)
    return base
  }
  // Fallbacks match locked Indie Campers times if depot.json is missing fields.
  if (which === 'pickup') base.setHours(15, 30, 0, 0)
  else base.setHours(11, 30, 0, 0)
  return base
}

/** Start-waypoint linger used when packing the Day 8 morning before return. */
function day8StartLingerH(day) {
  const first = (day.waypoints || [])[0]
  if (!first) return 0
  if (['start', 'via'].includes(first.kind)) return 0.05
  return stopDuration(day, first, 0)
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
  if (day.day === 1) {
    // Pickup appointment — Day 1 begins at the depot (mirrors depot.pickup).
    return depotAppointment(day, 'pickup')
  }
  if (day.day === 8) {
    // Return appointment — work back through morning drive so Return starts at
    // depot.return (11:30), same pattern as Day 1 pickup owning 15:30.
    const driveH = Number(day.drive_h_approx || 0)
    return addHours(depotAppointment(day, 'return'), -(driveH + day8StartLingerH(day)))
  }
  const base = parseDate(day)
  const ferry = day.ferry || {}
  const target = ferry.target_departure
  const firstWp = (day.waypoints || [])[0]
  // Only lead the day clock from the ferry when the day begins at the quay.
  if (target && firstWp?.kind === 'ferry') {
    const [hh, mm] = String(target).split(':').map(Number)
    if (Number.isFinite(hh)) {
      base.setHours(hh, mm || 0, 0, 0)
      const route = ferry.route || ''
      // Gryllefjord→Andenes needs a long camper queue; other crossings ~30 min.
      const leadH = route.includes('Gryllefjord') ? 2 : 0.5
      return addHours(base, -leadH)
    }
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
 * Day waypoints plus selected optionals that have lat/lon.
 * Real detours (not already on the must route) reshape the day map / GPX.
 * Protected / reserve activities at an existing stop still get a pin (activity
 * name) so bookable same-quay stops like whale safari stay visible.
 * @param {object} day
 * @param {Set<string>|string[]} selectedOptIds
 */
export function routingWaypoints(day, selectedOptIds) {
  const selected =
    selectedOptIds instanceof Set
      ? selectedOptIds
      : new Set(selectedOptIds || [])
  const wps = (day?.waypoints || []).map((wp) => ({ ...wp }))
  if (!wps.length) return wps

  /** @type {{ insertAt: number, wp: object }[]} */
  const pending = []

  ;(day.optional || []).forEach((item, oi) => {
    if (!item || typeof item === 'string') return
    const optId = `d${day.day}-o${oi}`
    if (!selected.has(optId)) return
    if (item.lat == null || item.lon == null) return

    const alreadyOnRoute = wps.some(
      (w) =>
        w.lat != null &&
        w.lon != null &&
        haversineM(w.lat, w.lon, item.lat, item.lon) < 400,
    )
    // Plain same-stop optionals (e.g. Hamn kayak) stay off the route pin list;
    // protected / reserve activities still need a labelled pin at the quay.
    if (alreadyOnRoute && !(item.protected || item.reserve)) return

    const anchor = item.after || item.during || item.on || item.place
    let insertAt = Math.max(0, wps.length - 1)
    if (anchor) {
      // Match place names loosely; only exact kind for bare anchors like "ferry"
      // (so "Andenes ferry" does not latch onto Gryllefjord's kind: ferry).
      const idx = wps.findIndex(
        (w) =>
          placeMatches(anchor, w.name) || norm(anchor) === norm(w.kind),
      )
      if (idx >= 0) insertAt = idx + 1
    }

    pending.push({
      insertAt,
      wp: {
        name: alreadyOnRoute
          ? item.activity || item.place || 'Optional stop'
          : item.place || item.activity || 'Optional stop',
        lat: item.lat,
        lon: item.lon,
        kind: 'viewpoint',
        optional: true,
        url: item.url || null,
        maps: item.maps || null,
      },
    })
  })

  pending.sort((a, b) => b.insertAt - a.insertAt || a.wp.name.localeCompare(b.wp.name))
  for (const { insertAt, wp } of pending) {
    wps.splice(insertAt, 0, wp)
  }
  return wps
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

function appendStepNote(step, text) {
  if (!step || !text) return
  step.notes = step.notes ? `${step.notes} · ${text}` : text
}

/** Infer which step a free-text day note belongs on. */
function inferNoteTarget(text) {
  const t = (text || '').toLowerCase()
  if (/grocery|groceries|stock up|stock groceries|shop\b|coop|city nord/.test(t)) {
    return { kind: 'shop' }
  }
  if (/pickup|pick up|late pickup|depot|indie campers|soft start/.test(t)) {
    return { kind: 'depot' }
  }
  if (/return before|return camper/.test(t)) {
    return { kind: 'depot' }
  }
  if (
    /sleep |overnight|quay so|close to the quay|buffer night|early night|sleep\b/.test(
      t,
    )
  ) {
    return { kind: 'sleep' }
  }
  if (
    /board ferry|ferry crossing|sailing|miss(ed)? the|queue for|join the camper queue/.test(
      t,
    )
  ) {
    return { ferry: true }
  }
  return { kind: 'sleep' }
}

function findNoteStep(steps, target) {
  if (!target || !steps?.length) return null

  if (target.kind === 'shop') {
    return (
      steps.find((s) => s.wpKind === 'shop') ||
      steps.find((s) => (s.activity || '').startsWith('Grocery'))
    )
  }
  if (target.kind === 'depot') {
    return (
      steps.find((s) => s.wpKind === 'depot') ||
      steps.find(
        (s) =>
          (s.activity || '').startsWith('Pick up') ||
          (s.activity || '').startsWith('Return'),
      )
    )
  }
  if (target.kind === 'sleep') {
    return (
      [...steps]
        .reverse()
        .find((s) => s.overnight || (s.activity || '').startsWith('Overnight')) ||
      [...steps].reverse().find((s) => s.wpKind === 'sleep')
    )
  }
  if (target.kind === 'viewpoint') {
    return steps.find((s) => s.wpKind === 'viewpoint')
  }
  if (target.ferry) {
    return (
      steps.find((s) => s.ferry) ||
      steps.find((s) => (s.activity || '').startsWith('Board ferry')) ||
      steps.find((s) => (s.activity || '').startsWith('Ferry crossing'))
    )
  }

  const keys = []
  if (target.during) keys.push(['during', String(target.during)])
  if (target.after) keys.push(['after', String(target.after)])
  if (target.on) keys.push(['after', String(target.on)])
  if (target.place) keys.push(['after', String(target.place)])

  for (const [mode, key] of keys) {
    for (const step of steps) {
      if (!placeMatches(key, step.place) && !placeMatches(key, step.activity)) continue
      if ((step.activity || '') === 'Drive') continue
      if (mode === 'during') return step
      return step
    }
  }
  return null
}

/**
 * Attach day.notes onto relevant steps.
 * Notes may be strings (auto-placed) or { text, kind|after|during|on|place|ferry }.
 */
function attachDayNotes(day, steps) {
  const leftovers = []
  for (const raw of day.notes || []) {
    let text
    let target
    if (typeof raw === 'string') {
      text = raw.trim()
      target = inferNoteTarget(text)
    } else if (raw && typeof raw === 'object') {
      text = String(raw.text || raw.note || '').trim()
      target = {
        kind: raw.kind || null,
        after: raw.after || null,
        during: raw.during || null,
        on: raw.on || null,
        place: raw.place || null,
        ferry: Boolean(raw.ferry),
      }
      if (
        !target.kind &&
        !target.after &&
        !target.during &&
        !target.on &&
        !target.place &&
        !target.ferry
      ) {
        target = inferNoteTarget(text)
      }
    } else {
      continue
    }
    if (!text) continue
    const step = findNoteStep(steps, target)
    if (step) appendStepNote(step, text)
    else leftovers.push(text)
  }

  if (!leftovers.length) return
  const sink =
    findNoteStep(steps, { kind: 'sleep' }) ||
    [...steps].reverse().find((s) => s.must && s.activity)
  if (sink) appendStepNote(sink, leftovers.join(' · '))
}

function isFerryLegStep(step) {
  const a = step.activity || ''
  return (
    Boolean(step.ferry) ||
    step.wpKind === 'ferry' ||
    a.startsWith('Board ferry') ||
    a.startsWith('Ferry crossing') ||
    a.startsWith('Ferry quay')
  )
}

function collapseFerryCluster(cluster) {
  if (cluster.length === 1) return cluster[0]

  const first = cluster[0]
  let durationH = 0
  const noteParts = []
  let route = ''
  let place = first.place || ''
  let url = first.url || null
  let maps = first.maps || null

  for (const s of cluster) {
    durationH += Number(s.duration_h || 0)
    const a = s.activity || ''
    if (a.startsWith('Board ferry — ')) route = a.slice('Board ferry — '.length)
    else if (a.startsWith('Ferry crossing — ')) route = a.slice('Ferry crossing — '.length)
    if (a.startsWith('Ferry crossing') && s.place) place = s.place
    if (s.url && !url) url = s.url
    if (s.maps && !maps) maps = s.maps
    if (s.notes) {
      for (const part of String(s.notes).split(' · ')) {
        const p = part.trim()
        if (p && !noteParts.includes(p)) noteParts.push(p)
      }
    }
  }

  return {
    ...first,
    activity: route ? `Ferry — ${route}` : 'Ferry',
    place,
    duration: fmtDuration(durationH),
    duration_h: durationH,
    notes: noteParts.join(' · '),
    must: true,
    ferry: true,
    wpKind: 'ferry',
    // Norwegian vehicle ferries on this trip are first-come; only keep if JSON set it.
    reserve: Boolean(first.reserve) || cluster.some((s) => s.reserve),
    url: url || first.url || null,
    maps: maps || first.maps || null,
  }
}

/** Collapse Board / Crossing / Quay into one ferry step with summed duration. */
function mergeFerrySteps(steps) {
  const out = []
  let i = 0
  while (i < steps.length) {
    if (!isFerryLegStep(steps[i])) {
      out.push(steps[i])
      i += 1
      continue
    }
    const cluster = []
    while (i < steps.length && isFerryLegStep(steps[i])) {
      cluster.push(steps[i])
      i += 1
    }
    out.push(collapseFerryCluster(cluster))
  }
  return out
}

function insertOptionals(day, steps, placeEndTimes, overnightDt) {
  if (!day.optional?.length) return steps

  const pending = []
  const limit = eveningLimit(day)

  day.optional.forEach((raw, oi) => {
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
    const isProtected = Boolean(item.protected)

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
        activity: isProtected ? `Protected — ${activity}` : `Optional — ${activity}`,
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
        protected: isProtected,
        fallback: item.fallback || null,
        optId: `d${day.day}-o${oi}`,
        optLabel: activity,
        reserve: Boolean(item.reserve),
        url: item.url || null,
        maps: item.maps || null,
        image: item.image || null,
        imageAlt: item.imageAlt || null,
        imageCredit: item.imageCredit || null,
        imagePage: item.imagePage || null,
      },
    ])
  })

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
    const oa =
      (a.activity || '').startsWith('Optional') || (a.activity || '').startsWith('Protected')
        ? 1
        : 0
    const ob =
      (b.activity || '').startsWith('Optional') || (b.activity || '').startsWith('Protected')
        ? 1
        : 0
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
          url: ferry.source || ferry.url || wp.url || null,
          maps: wp.maps || null,
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
      // Queue / board until the published departure so the crossing starts on time.
      dur = 0.25
      if (ferry.target_departure) {
        const [hh, mm] = String(ferry.target_departure).split(':').map(Number)
        if (Number.isFinite(hh)) {
          const depart = parseDate(day)
          depart.setHours(hh, mm || 0, 0, 0)
          const waitH = (depart.getTime() - clock.getTime()) / 3_600_000
          if (waitH > 0.05) dur = waitH
        }
      }
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
      } else if (day.day === 8 && wp.kind === 'depot') {
        notes = 'Indie Campers · return 11:30 · Håndverkervegen 6'
        // Lock appointment start (Day 1 pickup pattern) — ignore any early arrival slack.
        clock = depotAppointment(day, 'return')
      }
    }

    let must = ['depot', 'ferry', 'sleep'].includes(wp.kind) || i === 0
    if (wp.kind === 'viewpoint') must = false

    if (wp.kind === 'sleep') {
      const ov = day.overnight || {}
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
        overnight_type: ov.type || 'scenic',
        wpKind: wp.kind,
        reserve: Boolean(ov.reserve || wp.reserve),
        url: ov.url || wp.url || null,
        maps: ov.maps || wp.maps || null,
        fallback: wp.fallback || ov.fallback || null,
        image: ov.image || wp.image || null,
        imageAlt: ov.imageAlt || wp.imageAlt || null,
        imageCredit: ov.imageCredit || wp.imageCredit || null,
        imagePage: ov.imagePage || wp.imagePage || null,
      })
      placeEndTimes.push([wp.name, new Date(clock), steps.length - 1])
    } else if (dur > 0 || ['depot', 'ferry', 'shop', 'via', 'start'].includes(wp.kind)) {
      if (dur <= 0 && ['via', 'start'].includes(wp.kind)) dur = 0.05
      const isBoardFerry = wp.kind === 'ferry' && nextWp?.kind === 'ferry'
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
        wpKind: wp.kind,
        ferry: isBoardFerry ? true : undefined,
        reserve: Boolean(wp.reserve),
        url:
          (isBoardFerry ? ferry.source || ferry.url : null) ||
          wp.url ||
          null,
        maps: wp.maps || null,
        fallback: wp.fallback || null,
        image: wp.image || null,
        imageAlt: wp.imageAlt || null,
        imageCredit: wp.imageCredit || null,
        imagePage: wp.imagePage || null,
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
  attachDayNotes(day, out)
  out = mergeFerrySteps(out)

  out = out.map((s, idx) => {
    const { _dt, ...rest } = s
    const isProtected = Boolean(s.protected) || (s.activity || '').startsWith('Protected')
    const isOptional =
      Boolean(s.optional) ||
      (s.activity || '').startsWith('Optional') ||
      isProtected
    return {
      ...rest,
      date: idx === 0 ? dateLabel : '',
      protected: isProtected,
      optional: isOptional,
      startMs: _dt instanceof Date ? _dt.getTime() : null,
      baseStart: rest.start,
      rowClass: [
        isProtected ? 'protected' : '',
        isOptional && !isProtected ? 'optional' : '',
        s.overnight || s.activity?.startsWith('Overnight') ? 'overnight' : '',
        s.must && !isOptional ? 'must' : '',
      ]
        .filter(Boolean)
        .join(' '),
    }
  })

  return out
}

/**
 * Apply selected optional durations onto following steps.
 * @param {object[]} steps baseline steps from buildDaySteps
 * @param {Set<string>|string[]} selectedOptIds selected optional optIds
 */
export function applyOptionalSelection(steps, selectedOptIds) {
  const selected =
    selectedOptIds instanceof Set
      ? selectedOptIds
      : new Set(selectedOptIds || [])

  let delayH = 0
  const sources = []

  return (steps || []).map((step) => {
    const baseMs = step.startMs
    const shifted =
      baseMs != null && delayH > 0
        ? new Date(baseMs + Math.round(delayH * 60) * 60_000)
        : baseMs != null
          ? new Date(baseMs)
          : null

    const shiftSources = sources.map((s) => ({ ...s }))
    const out = {
      ...step,
      start: shifted ? fmtTime(shifted) : step.start,
      startMs: shifted ? shifted.getTime() : baseMs,
      timeShifted: delayH > 0,
      shiftH: delayH,
      shiftSources,
      included: step.optId ? selected.has(step.optId) : false,
    }

    if (step.optId && selected.has(step.optId)) {
      const dur = Number(step.duration_h || 0)
      if (dur > 0) {
        delayH += dur
        sources.push({
          optId: step.optId,
          activity: step.optLabel || step.activity,
          duration_h: dur,
          duration: fmtDuration(dur),
        })
      }
    }

    return out
  })
}

/** Default selection: protected blocks on, plain optionals off. */
export function defaultOptionalSelection(steps) {
  const ids = []
  for (const s of steps || []) {
    if (s.optId && s.protected) ids.push(s.optId)
  }
  return ids
}

/** Cook-in-van meal slots (Europe/Oslo wall clock on the day). */
const MEAL_DEFS = [
  {
    id: 'breakfast',
    label: 'Breakfast',
    hm: '08:00',
    duration_h: 0.3,
    place: 'In the van',
  },
  {
    id: 'lunch',
    label: 'Lunch',
    hm: '12:30',
    duration_h: 0.75,
    place: 'In the van / picnic',
  },
  {
    id: 'dinner',
    label: 'Dinner',
    hm: '19:00',
    duration_h: 0.85,
    place: 'In the van',
  },
]

function mealDate(day, hm) {
  const [y, m, d] = String(day.date).split('-').map(Number)
  const [hh, mm] = String(hm).split(':').map(Number)
  return new Date(y, m - 1, d, hh, mm || 0, 0, 0)
}

function mealsForDay(day, steps) {
  const firstStart = (steps || []).find((s) => s.startMs != null)?.startMs ?? null
  const lastStart = [...(steps || [])].reverse().find((s) => s.startMs != null)?.startMs ?? null

  return MEAL_DEFS.filter((def) => {
    if (def.id === 'breakfast' && day.day === 1) return false
    if (def.id === 'dinner' && day.day === 8) return false
    if (def.id === 'lunch' && day.day === 8) return false
    // Return morning: keep breakfast on the timeline, but do not pack it into the
    // locked 11:30 appointment (same idea as skipping lunch/dinner on Day 8).
    if (def.id === 'breakfast' && day.day === 8) return true

    const at = mealDate(day, def.hm).getTime()
    // Skip meals that fall entirely before the day clock starts (e.g. lunch on late Day 1),
    // but allow breakfast just before departure.
    if (firstStart != null && at < firstStart) {
      return def.id === 'breakfast'
    }
    // Skip meals long after the last step (nothing left to schedule around).
    if (lastStart != null && at > lastStart + 3 * 3600000 && def.id !== 'dinner') {
      return false
    }
    return true
  }).map((def) => {
    const at = mealDate(day, def.hm)
    return {
      ...def,
      startMs: at.getTime(),
      // Day 8 breakfast sits in the buffer morning; must not slide Return past 11:30.
      consumesTime: !(def.id === 'breakfast' && day.day === 8),
    }
  })
}

/**
 * Insert breakfast / lunch / dinner as interlines that consume time and shift
 * later starts on the clock. Preferred times are Europe/Oslo wall clock; if the
 * day already runs past a mealtime, the meal is inserted before the next step.
 * Meals do **not** set `timeShifted` / `*` — that marker is reserved for
 * selected optionals (`applyOptionalSelection`).
 */
export function insertMealInterlines(steps, day) {
  const list = steps || []
  const meals = mealsForDay(day, list)
  if (!meals.length) return list

  const out = []
  let delayMs = 0
  let mi = 0

  const pushMeal = (meal) => {
    const consumes = meal.consumesTime !== false
    const durH = consumes ? meal.duration_h : 0
    const durMs = Math.round(durH * 60) * 60_000
    out.push({
      meal: meal.id,
      activity: meal.label,
      start: fmtTime(new Date(meal.startMs)),
      startMs: meal.startMs,
      duration: fmtDuration(meal.duration_h),
      duration_h: meal.duration_h,
      place: meal.place,
      notes: '',
      must: false,
      interline: true,
      rowClass: `sun-row meal-row meal-row--${meal.id}`,
    })
    delayMs += durMs
  }

  const flushDueMeals = (effectiveMs) => {
    while (mi < meals.length && meals[mi].startMs <= effectiveMs) {
      pushMeal(meals[mi++])
    }
  }

  for (const step of list) {
    const base = step.startMs
    if (base != null) flushDueMeals(base + delayMs)

    const shifted = base != null ? new Date(base + delayMs) : null
    // Optional-only markers from applyOptionalSelection stay as-is.
    // Adjust baseStart so the * tooltip is "without this optional" on the
    // meal-adjusted clock, not the raw pre-meal itinerary time.
    const optMs = Math.round(Number(step.shiftH || 0) * 60) * 60_000
    const baseStart =
      delayMs > 0 && step.startMs != null
        ? fmtTime(new Date(step.startMs - optMs + delayMs))
        : step.baseStart
    out.push({
      ...step,
      start: shifted ? fmtTime(shifted) : step.start,
      startMs: shifted ? shifted.getTime() : step.startMs,
      baseStart,
    })
  }

  // Dinner (etc.) after an early overnight arrival
  while (mi < meals.length) pushMeal(meals[mi++])

  return out
}

/**
 * Insert sunrise / sunset as timeline interlines among timed steps.
 * Markers only — they do not consume time. Run after insertMealInterlines
 * so sun sits correctly on the meal-shifted clock.
 */
export function insertSunInterlines(steps, day) {
  const sun = sunMarkerDates(day)
  const markers = []
  if (sun.sunriseAt) {
    markers.push({
      sun: 'sunrise',
      activity: 'Sunrise',
      start: sun.sunrise,
      startMs: sun.sunriseAt.getTime(),
      duration: '—',
      place: sun.label,
      notes: '',
      must: false,
      rowClass: 'sun-row sun-row--rise',
      interline: true,
    })
  }
  if (sun.sunsetAt) {
    markers.push({
      sun: 'sunset',
      activity: 'Sunset',
      start: sun.sunset,
      startMs: sun.sunsetAt.getTime(),
      duration: '—',
      place: sun.label,
      notes: '',
      must: false,
      rowClass: 'sun-row sun-row--set',
      interline: true,
    })
  }
  markers.sort((a, b) => a.startMs - b.startMs)

  if (!markers.length) return steps || []

  const out = []
  let mi = 0
  for (const step of steps || []) {
    const t = step.startMs
    while (mi < markers.length && (t == null || markers[mi].startMs <= t)) {
      out.push(markers[mi++])
    }
    out.push(step)
  }
  while (mi < markers.length) out.push(markers[mi++])
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
    scenarios: day.scenarios || [],
    rawDay: day,
    steps: buildDaySteps(day),
  }))
}

function formatDayLabel(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}
