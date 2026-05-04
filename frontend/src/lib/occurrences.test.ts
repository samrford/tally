import { describe, it, expect } from 'vitest'
import {
  countOccurrencesInMonth,
  amountForMonth,
  isActiveInMonth,
} from './occurrences'
import type { RecurringPlain } from './outgoings'

const monthly = (startDate: string, endDate?: string) => ({
  startDate,
  endDate,
  frequency: { period: 1, unit: 'month' as const },
})

const weekly = (startDate: string, endDate?: string) => ({
  startDate,
  endDate,
  frequency: { period: 1, unit: 'week' as const },
})

const everyNWeeks = (n: number, startDate: string, endDate?: string) => ({
  startDate,
  endDate,
  frequency: { period: n, unit: 'week' as const },
})

const everyNMonths = (n: number, startDate: string, endDate?: string) => ({
  startDate,
  endDate,
  frequency: { period: n, unit: 'month' as const },
})

describe('countOccurrencesInMonth — monthly', () => {
  it('fires once in target month when start is before', () => {
    expect(countOccurrencesInMonth(monthly('2026-01-15'), '2026-03')).toBe(1)
  })

  it('fires once when start is in the target month', () => {
    expect(countOccurrencesInMonth(monthly('2026-03-15'), '2026-03')).toBe(1)
  })

  it('fires zero when start is after target month', () => {
    expect(countOccurrencesInMonth(monthly('2026-06-01'), '2026-03')).toBe(0)
  })

  it('end-of-month anchor gracefully degrades into Feb', () => {
    // Monthly on the 31st: should hit Feb 28 (2026 is non-leap), not spill.
    expect(countOccurrencesInMonth(monthly('2026-01-31'), '2026-02')).toBe(1)
  })

  it('end-of-month anchor feb degradation works in leap years', () => {
    expect(countOccurrencesInMonth(monthly('2024-01-31'), '2024-02')).toBe(1)
  })

  it('respects endDate — month after end is empty', () => {
    expect(
      countOccurrencesInMonth(monthly('2026-01-15', '2026-04-01'), '2026-05'),
    ).toBe(0)
  })

  it('respects endDate — same-month occurrence still counts when ≤ endDate', () => {
    expect(
      countOccurrencesInMonth(monthly('2026-01-15', '2026-04-20'), '2026-04'),
    ).toBe(1)
  })

  it('respects endDate — same-month occurrence excluded when > endDate', () => {
    // Anchor day is 15; endDate is 10th of that month → no occurrence.
    expect(
      countOccurrencesInMonth(monthly('2026-01-15', '2026-04-10'), '2026-04'),
    ).toBe(0)
  })
})

describe('countOccurrencesInMonth — weekly variants', () => {
  it('weekly: 5 hits in a 31-day month aligned to start', () => {
    // 2026-01-01 is a Thursday. Jan 1, 8, 15, 22, 29 → 5.
    expect(countOccurrencesInMonth(weekly('2026-01-01'), '2026-01')).toBe(5)
  })

  it('weekly: 4 hits when only four full weeks land in the month', () => {
    // 2026-02-05 is Thu. Feb 5, 12, 19, 26 → 4.
    expect(countOccurrencesInMonth(weekly('2026-02-05'), '2026-02')).toBe(4)
  })

  it('fortnightly: counts every 2 weeks', () => {
    // Start 2026-01-01 (Thu). In Jan: 1, 15, 29 → 3.
    expect(countOccurrencesInMonth(everyNWeeks(2, '2026-01-01'), '2026-01')).toBe(3)
  })

  it('every 4 weeks: typically hits once per calendar month', () => {
    // Start 2026-01-01. Jan 1, 29 → 2 in Jan.
    expect(countOccurrencesInMonth(everyNWeeks(4, '2026-01-01'), '2026-01')).toBe(2)
    // Feb has Feb 26 only → 1.
    expect(countOccurrencesInMonth(everyNWeeks(4, '2026-01-01'), '2026-02')).toBe(1)
  })

  it('every 6 weeks: hits 0 or 1 times per calendar month', () => {
    // Start 2026-01-15. Schedule: Jan 15, Feb 26, Apr 9, May 21, Jul 2, ...
    expect(countOccurrencesInMonth(everyNWeeks(6, '2026-01-15'), '2026-01')).toBe(1)
    expect(countOccurrencesInMonth(everyNWeeks(6, '2026-01-15'), '2026-02')).toBe(1)
    expect(countOccurrencesInMonth(everyNWeeks(6, '2026-01-15'), '2026-03')).toBe(0)
    expect(countOccurrencesInMonth(everyNWeeks(6, '2026-01-15'), '2026-04')).toBe(1)
    expect(countOccurrencesInMonth(everyNWeeks(6, '2026-01-15'), '2026-05')).toBe(1)
    expect(countOccurrencesInMonth(everyNWeeks(6, '2026-01-15'), '2026-06')).toBe(0)
  })
})

describe('countOccurrencesInMonth — quarterly / yearly', () => {
  it('quarterly: fires only every 3 months from anchor', () => {
    expect(countOccurrencesInMonth(everyNMonths(3, '2026-01-15'), '2026-01')).toBe(1)
    expect(countOccurrencesInMonth(everyNMonths(3, '2026-01-15'), '2026-02')).toBe(0)
    expect(countOccurrencesInMonth(everyNMonths(3, '2026-01-15'), '2026-04')).toBe(1)
  })

  it('annual: fires once a year on the anchor month', () => {
    expect(countOccurrencesInMonth(everyNMonths(12, '2025-05-01'), '2026-05')).toBe(1)
    expect(countOccurrencesInMonth(everyNMonths(12, '2025-05-01'), '2026-04')).toBe(0)
    expect(countOccurrencesInMonth(everyNMonths(12, '2025-05-01'), '2026-06')).toBe(0)
  })
})

describe('isActiveInMonth', () => {
  it('true when item fires in the month', () => {
    expect(isActiveInMonth(monthly('2026-01-15'), '2026-03')).toBe(true)
  })
  it('false when item ended before the month', () => {
    expect(isActiveInMonth(monthly('2026-01-15', '2026-02-15'), '2026-04')).toBe(false)
  })
  it('false when item starts after the month', () => {
    expect(isActiveInMonth(monthly('2026-06-01'), '2026-03')).toBe(false)
  })
})

describe('amountForMonth', () => {
  const baseRecurring = (overrides: Partial<RecurringPlain> = {}): RecurringPlain => ({
    v: 2,
    kind: 'recurring',
    name: 'Test',
    amount: 1500,
    category: 'bills',
    frequency: { period: 1, unit: 'month' },
    startDate: '2026-01-15',
    ...overrides,
  })

  it('non-variable: amount × occurrences, not an estimate', () => {
    const item = baseRecurring()
    expect(amountForMonth(item, '2026-03')).toEqual({
      pence: 1500,
      isEstimate: false,
    })
  })

  it('non-variable weekly: amount × per-month occurrence count', () => {
    const item = baseRecurring({
      amount: 500,
      frequency: { period: 1, unit: 'week' },
      startDate: '2026-01-01',
    })
    // 5 occurrences in Jan → 2500p.
    expect(amountForMonth(item, '2026-01')).toEqual({
      pence: 2500,
      isEstimate: false,
    })
  })

  it('variable with override: uses override exactly', () => {
    const item = baseRecurring({
      variable: true,
      overrides: { '2026-03': 8250 },
    })
    expect(amountForMonth(item, '2026-03')).toEqual({
      pence: 8250,
      isEstimate: false,
    })
  })

  it('variable without override: returns baseline as estimate', () => {
    const item = baseRecurring({ variable: true })
    expect(amountForMonth(item, '2026-03')).toEqual({
      pence: 1500,
      isEstimate: true,
    })
  })

  it('variable with override = 0 still uses 0 (not estimate)', () => {
    const item = baseRecurring({
      variable: true,
      overrides: { '2026-03': 0 },
    })
    expect(amountForMonth(item, '2026-03')).toEqual({
      pence: 0,
      isEstimate: false,
    })
  })

  it('inactive month: zero pence, not an estimate', () => {
    const item = baseRecurring({
      variable: true,
      startDate: '2026-06-01',
    })
    expect(amountForMonth(item, '2026-03')).toEqual({
      pence: 0,
      isEstimate: false,
    })
  })
})
