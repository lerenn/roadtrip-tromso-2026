/**
 * Bootstrap Icons for timeline steps — one glyph per activity family.
 * Classes are `bi bi-*` (see https://icons.getbootstrap.com/).
 */

/** @typedef {{ icon: string, label: string }} StepIcon */

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
    step?.protected ||
    step?.optId ||
    a.startsWith('Optional') ||
    a.startsWith('Protected')
  ) {
    return { icon: 'bi-stars', label: 'Activity' }
  }
  if (kind === 'via' || kind === 'start') {
    return { icon: 'bi-geo-alt', label: 'Place' }
  }
  return { icon: 'bi-geo-alt', label: 'Place' }
}
