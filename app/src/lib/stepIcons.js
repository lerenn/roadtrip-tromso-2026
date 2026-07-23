/**
 * Bootstrap Icons for timeline steps.
 * Structural kinds (drive, ferry, overnight, …) first; optionals then match by
 * activity text (hike, kayak, café, …).
 * Classes are `bi bi-*` (see https://icons.getbootstrap.com/).
 */

/** @typedef {{ icon: string, label: string }} StepIcon */

/**
 * Classify optional / free-form activity labels.
 * Prefers `optLabel` (raw optional name) when present.
 * @param {object} step
 * @returns {StepIcon}
 */
function iconForActivity(step) {
  const raw = `${step?.optLabel || ''} ${step?.activity || ''} ${step?.place || ''}`
  const t = raw
    .replace(/^Optional\s*[—–-]\s*/i, '')
    .toLowerCase()

  if (/whale\s*safari|\bwhales?\b/.test(t) && !/centre|center|museum/.test(t)) {
    return { icon: 'bi-eye', label: 'Wildlife' }
  }
  if (/kayak|\bsup\b/.test(t)) {
    return { icon: 'bi-life-preserver', label: 'Kayak' }
  }
  if (/sauna|fjord dip|hot pool|beach sauna/.test(t)) {
    return { icon: 'bi-thermometer-sun', label: 'Sauna' }
  }
  if (/cable car|fjellheisen/.test(t)) {
    return { icon: 'bi-ticket-perforated', label: 'Cable car' }
  }
  if (/café|cafe|galleries/.test(t)) {
    return { icon: 'bi-cup-straw', label: 'Café' }
  }
  if (/museum|whales centre|whales center|spaceship aurora/.test(t)) {
    return { icon: 'bi-building', label: 'Museum' }
  }
  if (/beach/.test(t)) {
    return { icon: 'bi-umbrella', label: 'Beach' }
  }
  if (/drone|photography|photo stop|\bphotos\b/.test(t)) {
    return { icon: 'bi-camera', label: 'Photo' }
  }
  if (/grocery|van service/.test(t)) {
    return { icon: 'bi-cart3', label: 'Shop' }
  }
  if (
    /\b(detour|spur|harbour|harbor|roadside|village walk|early sleep)\b/.test(t)
  ) {
    return { icon: 'bi-signpost-2', label: 'Detour' }
  }
  if (
    /hike|summit|climb|short walk|viewpoint walk|boardwalk|foss|breen|bridge short walk|lighthouse/.test(
      t,
    )
  ) {
    return { icon: 'bi-person-walking', label: 'Hike' }
  }
  return { icon: 'bi-stars', label: 'Activity' }
}

/**
 * @param {object} step
 * @returns {StepIcon}
 */
export function iconForStep(step) {
  const a = step?.activity || ''
  const kind = step?.wpKind || ''

  if (step?.meal || /^(Breakfast|Lunch|Dinner)$/i.test(a)) {
    return { icon: 'bi-cup-hot', label: 'Meal' }
  }
  if (a === 'Sunset' || step?.rowClass?.includes('sun-row--set')) {
    return { icon: 'bi-sunset', label: 'Sunset' }
  }
  if (
    a === 'Sunrise' ||
    step?.sun ||
    step?.rowClass?.includes('sun-row--rise')
  ) {
    return { icon: 'bi-sunrise', label: 'Sunrise' }
  }
  if (a === 'Drive') {
    return { icon: 'bi-truck-front', label: 'Drive' }
  }
  if (
    step?.ferry ||
    kind === 'ferry' ||
    a.startsWith('Ferry') ||
    a.startsWith('Board ferry')
  ) {
    return { icon: 'bi-water', label: 'Ferry' }
  }
  if (step?.overnight || kind === 'sleep' || a.startsWith('Overnight')) {
    return { icon: 'bi-moon-stars', label: 'Overnight' }
  }
  if (kind === 'depot' || a.startsWith('Pick up') || a.startsWith('Return')) {
    return { icon: 'bi-key', label: 'Depot' }
  }
  if (kind === 'shop' || a.startsWith('Grocery')) {
    return { icon: 'bi-cart3', label: 'Shop' }
  }
  if (
    kind === 'viewpoint' ||
    a.startsWith('Stop —') ||
    a.startsWith('Stop -')
  ) {
    return { icon: 'bi-binoculars', label: 'Stop' }
  }
  if (
    step?.optId ||
    step?.optional ||
    a.startsWith('Optional')
  ) {
    return iconForActivity(step)
  }
  if (kind === 'via' || kind === 'start') {
    return { icon: 'bi-geo-alt', label: 'Place' }
  }
  return { icon: 'bi-geo-alt', label: 'Place' }
}
