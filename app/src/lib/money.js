/**
 * Trip money helpers: compact NOK display + approximate EUR.
 * Rate is a planning snapshot (not live FX) — see RATE_NOTE.
 */

/** Mid-market-ish NOK→EUR (~Jul 2026). 1 NOK ≈ 0.0906 EUR → ~11.04 NOK/EUR. */
export const EUR_PER_NOK = 0.0906
export const RATE_NOTE = '≈0.0906 EUR/NOK (planning rate, Jul 2026)'

/**
 * @param {number} nok
 * @returns {string} e.g. "21"
 */
export function nokToEurAmount(nok) {
  const eur = nok * EUR_PER_NOK
  if (eur >= 100) return String(Math.round(eur))
  if (eur >= 10) return eur.toFixed(0)
  return eur.toFixed(0)
}

/**
 * Parse a free-text `price` string into a compact NOK label + EUR hint.
 * Prefers party totals (`→ ≈1025 NOK`, `≈ 3380 NOK`) over unit rates.
 *
 * @param {string | null | undefined} price
 * @returns {{ nok: string, eur: string, full: string } | null}
 */
export function formatPriceChip(price) {
  if (!price || typeof price !== 'string') return null
  const full = price.trim()
  if (!full) return null

  const arrowTotal = full.match(/→\s*≈?\s*([\d\s]+)\s*NOK/i)
  if (arrowTotal) {
    const n = Number(arrowTotal[1].replace(/\s/g, ''))
    if (Number.isFinite(n)) {
      return {
        nok: `${n} NOK`,
        eur: `≈${nokToEurAmount(n)} €`,
        full,
      }
    }
  }

  const approxTotal = full.match(/≈\s*([\d\s]+)\s*NOK(?!\s*\/)/i)
  if (approxTotal && /2\s*[×x]|for\s*2/i.test(full)) {
    const n = Number(approxTotal[1].replace(/\s/g, ''))
    if (Number.isFinite(n) && n >= 100) {
      return {
        nok: `${n} NOK`,
        eur: `≈${nokToEurAmount(n)} €`,
        full,
      }
    }
  }

  const eqTotal = full.match(/=\s*([\d\s]+)\s*NOK/i)
  if (eqTotal) {
    const n = Number(eqTotal[1].replace(/\s/g, ''))
    if (Number.isFinite(n)) {
      return {
        nok: `${n} NOK`,
        eur: `≈${nokToEurAmount(n)} €`,
        full,
      }
    }
  }

  const range = full.match(/≈?\s*([\d\s]+)\s*[–-]\s*([\d\s]+)\s*NOK/i)
  if (range) {
    const a = Number(range[1].replace(/\s/g, ''))
    const b = Number(range[2].replace(/\s/g, ''))
    if (Number.isFinite(a) && Number.isFinite(b)) {
      return {
        nok: `${a}–${b} NOK`,
        eur: `≈${nokToEurAmount(a)}–${nokToEurAmount(b)} €`,
        full,
      }
    }
  }

  const single = full.match(/([\d\s]+)\s*NOK/i)
  if (single) {
    const n = Number(single[1].replace(/\s/g, ''))
    if (Number.isFinite(n)) {
      return {
        nok: `${n} NOK`,
        eur: `≈${nokToEurAmount(n)} €`,
        full,
      }
    }
  }

  return null
}
