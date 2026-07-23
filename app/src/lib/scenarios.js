/**
 * Contingency helpers for the integrated schema:
 *
 * Day-level:
 *   day.scenarios[] = {
 *     id, when, summary,
 *     attach?: "ferry_crossing" | "overnight" — line toggle (not top picker),
 *     replace?: partial day fields for THIS day,
 *     ripple?: [{ day, banner?, replace }]
 *   }
 *
 * Line-level fallback on optionals is discouraged — prefer separate optionals.
 * (UI still renders `fallback` if present.)
 */

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj))
}

/** Shallow-merge objects; arrays and scalars replace. Nested plain objects merge. */
function applyReplace(target, replace) {
  if (!replace || typeof replace !== 'object') return target
  for (const [key, value] of Object.entries(replace)) {
    const cur = target[key]
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      cur &&
      typeof cur === 'object' &&
      !Array.isArray(cur)
    ) {
      target[key] = { ...cur, ...deepClone(value) }
    } else {
      target[key] = deepClone(value)
    }
  }
  return target
}

function selectedSet(selectedIds) {
  if (selectedIds instanceof Set) return selectedIds
  return new Set(selectedIds || [])
}

function attachKind(scenario) {
  const attach = scenario?.attach
  if (!attach) return null
  if (typeof attach === 'string') return attach
  return attach.kind || null
}

export function isFerryAttachedScenario(scenario) {
  return attachKind(scenario) === 'ferry_crossing'
}

export function isOvernightAttachedScenario(scenario) {
  return attachKind(scenario) === 'overnight'
}

/** Line-attached scenarios are not listed in the day-header What-if picker. */
export function isLineAttachedScenario(scenario) {
  return isFerryAttachedScenario(scenario) || isOvernightAttachedScenario(scenario)
}

/** Scenarios toggled from the ferry crossing step on this day (anchor only). */
export function ferryScenariosForDay(itinerary, dayNumber) {
  const day = (itinerary.days || []).find((d) => d.day === dayNumber)
  if (!day) return []
  return (day.scenarios || [])
    .filter((s) => isFerryAttachedScenario(s))
    .map((s) => ({
      ...s,
      anchor_day: day.day,
      role: 'anchor',
    }))
}

/** Scenarios toggled from the overnight / sleep step on this day (anchor only). */
export function overnightScenariosForDay(itinerary, dayNumber) {
  const day = (itinerary.days || []).find((d) => d.day === dayNumber)
  if (!day) return []
  return (day.scenarios || [])
    .filter((s) => isOvernightAttachedScenario(s))
    .map((s) => ({
      ...s,
      anchor_day: day.day,
      role: 'anchor',
      /** Short UI chip: Prefer campsite | Prefer wild */
      lineLabel: String(s.id || '').startsWith('wild_alt_')
        ? 'Prefer wild'
        : 'Prefer campsite',
    }))
}

/** All scenario patches that touch a day (anchor + ripples). */
export function scenariosForDay(itinerary, dayNumber) {
  const out = []
  for (const day of itinerary.days || []) {
    for (const s of day.scenarios || []) {
      if (day.day === dayNumber) {
        out.push({
          ...s,
          anchor_day: day.day,
          role: 'anchor',
        })
      }
      for (const r of s.ripple || []) {
        if (r.day === dayNumber) {
          out.push({
            id: s.id,
            when: s.when,
            summary: s.summary,
            banner: r.banner || s.summary,
            replace: r.replace || {},
            attach: s.attach,
            anchor_day: day.day,
            role: 'ripple',
          })
        }
      }
    }
  }
  return out
}

/**
 * Unique selectable What-ifs for a day (one checkbox per scenario id).
 * Excludes line-attached scenarios (ferry crossing / overnight) — those live on the step.
 */
export function scenarioChoicesForDay(itinerary, dayNumber) {
  const byId = new Map()
  for (const entry of scenariosForDay(itinerary, dayNumber)) {
    if (isLineAttachedScenario(entry)) continue
    const existing = byId.get(entry.id)
    if (!existing) {
      byId.set(entry.id, {
        id: entry.id,
        when: entry.when,
        summary: entry.summary,
        banner: entry.banner || entry.summary,
        anchor_day: entry.anchor_day,
        roles: [entry.role],
        rippleDays:
          entry.role === 'anchor'
            ? (entry.ripple || []).map((r) => r.day)
            : [],
      })
    } else {
      if (!existing.roles.includes(entry.role)) existing.roles.push(entry.role)
      if (entry.role === 'ripple') {
        existing.banner = entry.banner || existing.banner
      }
      if (entry.role === 'anchor' && entry.ripple?.length) {
        existing.rippleDays = entry.ripple.map((r) => r.day)
      }
    }
  }
  return [...byId.values()]
}

/** Build a patched day object for a single scenario branch. */
export function materializeScenarioDay(baseDay, scenario) {
  const day = deepClone(baseDay)
  applyReplace(day, scenario.replace || {})
  return day
}

/**
 * Apply every selected scenario that affects this day (multi-select).
 * Patches apply in itinerary order (anchor day, then scenario list, then ripples).
 * Nested objects in `replace` (e.g. ferry.target_departure) deep-merge.
 */
export function materializeDayWithSelection(itinerary, dayNumber, selectedIds) {
  const selected = selectedSet(selectedIds)
  const source = (itinerary.days || []).find((d) => d.day === dayNumber)
  if (!source) return { day: null, applied: [] }

  const day = deepClone(source)
  const applied = []

  for (const srcDay of itinerary.days || []) {
    for (const s of srcDay.scenarios || []) {
      if (!selected.has(s.id)) continue

      if (srcDay.day === dayNumber && s.replace) {
        applyReplace(day, s.replace)
        applied.push({
          id: s.id,
          when: s.when,
          role: 'anchor',
          banner: s.banner || s.summary,
        })
      }

      for (const r of s.ripple || []) {
        if (r.day !== dayNumber || !r.replace) continue
        applyReplace(day, r.replace)
        applied.push({
          id: s.id,
          when: s.when,
          role: 'ripple',
          banner: r.banner || s.summary,
          anchor_day: srcDay.day,
        })
      }
    }
  }

  // Keep original scenario list for the picker; patches shouldn't drop it.
  day.scenarios = source.scenarios || []
  day.day = source.day
  day.date = source.date
  day.weekday = source.weekday

  return { day, applied }
}

/** Materialize all days under the current multi-select. */
export function materializeItineraryDays(itinerary, selectedIds) {
  return (itinerary.days || []).map((d) => {
    const { day, applied } = materializeDayWithSelection(
      itinerary,
      d.day,
      selectedIds,
    )
    return { day, applied }
  })
}

export function hasAnyScenarios(itinerary) {
  return (itinerary.days || []).some(
    (d) => (d.scenarios && d.scenarios.length) || false,
  )
}
