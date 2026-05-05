import { describe, it, expect } from 'vitest'
import {
  calcIncomeTax,
  calcNI,
  calculateTakeHome,
  UK_2025_26,
} from './uk-tax'

// All amounts are in pence. £1 = 100p.
const p = (pounds: number) => Math.round(pounds * 100)

describe('UK income tax (2025/26 rUK)', () => {
  it('owes nothing below the personal allowance', () => {
    expect(calcIncomeTax(p(10_000))).toBe(0)
    expect(calcIncomeTax(p(12_570))).toBe(0)
  })

  it('charges 20% in the basic-rate band', () => {
    // £20,000 - £12,570 = £7,430 taxable @ 20% = £1,486
    expect(calcIncomeTax(p(20_000))).toBe(p(1_486))
    // Top of basic rate: £50,270 - £12,570 = £37,700 @ 20% = £7,540
    expect(calcIncomeTax(p(50_270))).toBe(p(7_540))
  })

  it('charges 40% in the higher-rate band', () => {
    // £60,000: £37,700 @ 20% + £9,730 @ 40% = £7,540 + £3,892 = £11,432
    expect(calcIncomeTax(p(60_000))).toBe(p(11_432))
  })

  it('tapers the personal allowance above £100k', () => {
    // £100,000: PA still full. Tax = £37,700@20% + £49,730@40% = £7,540 + £19,892 = £27,432
    expect(calcIncomeTax(p(100_000))).toBe(p(27_432))
    // £125,140: PA fully tapered to 0.
    // Tax = £37,700@20% + (125,140-37,700)@40% = £7,540 + £34,976 = £42,516
    expect(calcIncomeTax(p(125_140))).toBe(p(42_516))
  })

  it('charges 45% above £125,140', () => {
    // £150,000: PA = 0. Taxable = £150,000.
    // £37,700@20% + £87,440@40% + £24,860@45% = £7,540 + £34,976 + £11,187 = £53,703
    expect(calcIncomeTax(p(150_000))).toBe(p(53_703))
  })
})

describe('UK National Insurance (Class 1 employee, 2025/26)', () => {
  it('owes nothing below the primary threshold', () => {
    expect(calcNI(p(10_000))).toBe(0)
    expect(calcNI(p(12_570))).toBe(0)
  })

  it('charges 8% between PT and UEL', () => {
    // £20,000: (20,000 - 12,570) * 8% = 7,430 * 0.08 = £594.40
    expect(calcNI(p(20_000))).toBe(p(594.4))
    // At UEL £50,270: (50,270 - 12,570) * 8% = 37,700 * 0.08 = £3,016
    expect(calcNI(p(50_270))).toBe(p(3_016))
  })

  it('charges 2% above UEL', () => {
    // £60,000: £3,016 + (60,000 - 50,270) * 2% = £3,016 + £194.60 = £3,210.60
    expect(calcNI(p(60_000))).toBe(p(3_210.6))
  })
})

describe('calculateTakeHome', () => {
  it('combines tax + NI for a typical £40k salary', () => {
    const r = calculateTakeHome({
      annualGross: p(40_000),
      pensionPct: 0,
      otherDeductions: [],
    })
    expect(r.incomeTaxAnnual).toBe(p(5_486)) // (40,000-12,570)*0.2
    expect(r.niAnnual).toBe(p(2_194.4)) // (40,000-12,570)*0.08
    expect(r.netAnnual).toBe(p(40_000) - p(5_486) - p(2_194.4))
  })

  it('reduces tax + NI when pension is salary-sacrificed', () => {
    const noPension = calculateTakeHome({
      annualGross: p(40_000),
      pensionPct: 0,
      otherDeductions: [],
    })
    const withPension = calculateTakeHome({
      annualGross: p(40_000),
      pensionPct: 5,
      otherDeductions: [],
    })
    // Pension £2,000 reduces taxable to £38,000.
    expect(withPension.pensionAnnual).toBe(p(2_000))
    expect(withPension.taxableGross).toBe(p(38_000))
    expect(withPension.incomeTaxAnnual).toBeLessThan(noPension.incomeTaxAnnual)
    expect(withPension.niAnnual).toBeLessThan(noPension.niAnnual)
  })

  it('subtracts pre-tax other deductions from gross before tax', () => {
    const r = calculateTakeHome({
      annualGross: p(40_000),
      pensionPct: 0,
      otherDeductions: [
        {
          id: 'cycle',
          name: 'Cycle to work',
          monthly: p(50),
          preTax: true,
        },
      ],
    })
    // £600/yr pre-tax → taxable £39,400
    expect(r.taxableGross).toBe(p(39_400))
    expect(r.otherPreTaxAnnual).toBe(p(600))
  })

  it('subtracts post-tax deductions from net only', () => {
    const r = calculateTakeHome({
      annualGross: p(40_000),
      pensionPct: 0,
      otherDeductions: [
        {
          id: 'gym',
          name: 'Gym',
          monthly: p(40),
          preTax: false,
        },
      ],
    })
    expect(r.taxableGross).toBe(p(40_000))
    expect(r.otherPostTaxAnnual).toBe(p(480))
    expect(r.netAnnual).toBe(
      p(40_000) - r.incomeTaxAnnual - r.niAnnual - p(480),
    )
  })

  it('returns sensible monthly figures', () => {
    const r = calculateTakeHome({
      annualGross: p(60_000),
      pensionPct: 5,
      otherDeductions: [],
    })
    expect(r.monthly.gross).toBe(Math.round(r.annualGross / 12))
    expect(r.monthly.net).toBe(Math.round(r.netAnnual / 12))
  })

  it('handles zero gross gracefully', () => {
    const r = calculateTakeHome({
      annualGross: 0,
      pensionPct: 5,
      otherDeductions: [],
    })
    expect(r.netAnnual).toBe(0)
    expect(r.effectiveRate).toBe(0)
  })

  it('exposes the configured tax-year label', () => {
    const r = calculateTakeHome({
      annualGross: p(30_000),
      pensionPct: 0,
      otherDeductions: [],
    })
    expect(r.cfgLabel).toBe(UK_2025_26.label)
  })
})
