// Occurrence maths for recurring outgoings — computes how many times a
// recurring item fires within a given calendar month, and the resolved
// monthly pence amount (override or baseline × occurrences).
//
// Date handling is UTC-only to dodge DST/local-time edge cases. Inputs and
// outputs are 'YYYY-MM-DD' / 'YYYY-MM' strings.

import type { Frequency, RecurringPlain } from '@/lib/outgoings'

const MAX_ITERATIONS = 10_000 // safety cap; well above any realistic schedule

export function parseYMD(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function lastDayOfMonth(year: number, monthZeroIdx: number): number {
  // Day 0 of next month = last day of this month.
  return new Date(Date.UTC(year, monthZeroIdx + 1, 0)).getUTCDate()
}

export function monthBounds(ym: string): { start: Date; end: Date } {
  const [y, m] = ym.split('-').map(Number)
  return {
    start: new Date(Date.UTC(y, m - 1, 1)),
    end: new Date(Date.UTC(y, m - 1, lastDayOfMonth(y, m - 1))),
  }
}

// Step n periods from `start`. For weeks, that's exact arithmetic. For
// months, we always reckon from the original anchor (no compounding) and
// cap day-of-month to the target month's last day, so "monthly on the 31st"
// gives Feb 28/29 rather than spilling into March.
function nthOccurrence(start: Date, n: number, freq: Frequency): Date {
  if (freq.unit === 'week') {
    return new Date(start.getTime() + n * freq.period * 7 * 86_400_000)
  }
  const anchorDay = start.getUTCDate()
  const totalMonths = n * freq.period
  const targetMonth = start.getUTCMonth() + totalMonths
  const targetYear =
    start.getUTCFullYear() + Math.floor(targetMonth / 12)
  const wrappedMonth = ((targetMonth % 12) + 12) % 12
  const day = Math.min(anchorDay, lastDayOfMonth(targetYear, wrappedMonth))
  return new Date(Date.UTC(targetYear, wrappedMonth, day))
}

export interface OccurrenceItem {
  startDate: string
  endDate?: string
  frequency: Frequency
}

export function countOccurrencesInMonth(
  item: OccurrenceItem,
  ym: string,
): number {
  const start = parseYMD(item.startDate)
  const end = item.endDate ? parseYMD(item.endDate) : null
  const { start: monthStart, end: monthEnd } = monthBounds(ym)

  if (start.getTime() > monthEnd.getTime()) return 0
  if (end && end.getTime() < monthStart.getTime()) return 0

  let count = 0
  for (let n = 0; n < MAX_ITERATIONS; n++) {
    const occ = nthOccurrence(start, n, item.frequency)
    if (occ.getTime() > monthEnd.getTime()) break
    if (end && occ.getTime() > end.getTime()) break
    if (occ.getTime() >= monthStart.getTime()) count++
  }
  return count
}

// Resolved monthly amount in pence + whether it's an estimate (variable
// item with no override set for this month).
export function amountForMonth(
  item: RecurringPlain,
  ym: string,
): { pence: number; isEstimate: boolean } {
  const override = item.overrides?.[ym]
  if (item.variable && typeof override === 'number') {
    return { pence: override, isEstimate: false }
  }
  const occurrences = countOccurrencesInMonth(item, ym)
  return {
    pence: item.amount * occurrences,
    isEstimate: !!item.variable && occurrences > 0,
  }
}

// Whether a recurring item has any occurrence in the given month — used to
// decide if it should appear in that month's table at all.
export function isActiveInMonth(item: OccurrenceItem, ym: string): boolean {
  return countOccurrencesInMonth(item, ym) > 0
}
