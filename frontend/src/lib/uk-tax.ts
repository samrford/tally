// UK income tax + National Insurance calculation for employees on PAYE.
//
// All money is handled in pence (integer) to avoid float drift. Inputs are
// annual figures; convert to monthly at the call site if needed.
//
// Rates reflect HMRC bands as frozen through April 2028 (rUK — Scotland uses
// a different income-tax schedule which is not modelled here). Pension salary
// sacrifice is applied before both income tax and NI: that's the whole point
// of the salary-sacrifice arrangement.

export interface NIBand {
  // Upper bound of this NI band in pence; null = open-ended (top band).
  upTo: number | null
  rate: number // 0..1
}

export interface TaxYearConfig {
  label: string
  // Income tax (rUK)
  personalAllowance: number // pence
  // Above this gross, personal allowance reduces by £1 per £2.
  paTaperStart: number // pence
  // Width of the basic-rate band in taxable terms — fixed irrespective of PA.
  basicRateBandWidth: number // pence; e.g. £37,700
  basicRate: number
  // Gross threshold at which the additional rate kicks in.
  additionalRateThreshold: number // pence; e.g. £125,140
  higherRate: number
  additionalRate: number
  // NI Class 1 employee bands applied to gross (after salary sacrifice).
  niBands: NIBand[]
}

// 2025/26 rUK rates — also current for 2026/27 under the freeze.
export const UK_2025_26: TaxYearConfig = {
  label: '2025/26',
  personalAllowance: 1_257_000,
  paTaperStart: 10_000_000,
  basicRateBandWidth: 3_770_000,
  basicRate: 0.2,
  additionalRateThreshold: 12_514_000,
  higherRate: 0.4,
  additionalRate: 0.45,
  niBands: [
    { upTo: 1_257_000, rate: 0 },
    { upTo: 5_027_000, rate: 0.08 },
    { upTo: null, rate: 0.02 },
  ],
}

function effectivePersonalAllowance(
  gross: number,
  cfg: TaxYearConfig,
): number {
  if (gross <= cfg.paTaperStart) return cfg.personalAllowance
  const excess = gross - cfg.paTaperStart
  const reduction = Math.floor(excess / 2)
  return Math.max(0, cfg.personalAllowance - reduction)
}

// Income tax at the gross-income level. Bands shift with the personal-
// allowance taper: as PA shrinks, the basic-rate band slides down with it,
// but the additional-rate threshold stays fixed at gross £125,140.
export function calcIncomeTax(
  gross: number,
  cfg: TaxYearConfig = UK_2025_26,
): number {
  if (gross <= 0) return 0
  const pa = effectivePersonalAllowance(gross, cfg)
  const basicTop = pa + cfg.basicRateBandWidth
  const higherTop = cfg.additionalRateThreshold

  const basic =
    Math.max(0, Math.min(gross, basicTop) - pa) * cfg.basicRate
  const higher =
    Math.max(0, Math.min(gross, higherTop) - Math.max(pa, basicTop)) *
    cfg.higherRate
  const addl =
    Math.max(0, gross - Math.max(pa, higherTop)) * cfg.additionalRate

  return Math.round(basic + higher + addl)
}

export function calcNI(
  niableGross: number,
  cfg: TaxYearConfig = UK_2025_26,
): number {
  let owed = 0
  let cursor = 0
  for (const band of cfg.niBands) {
    const cap = band.upTo ?? Infinity
    if (niableGross <= cursor) break
    const slice = Math.min(niableGross, cap) - cursor
    if (slice > 0) owed += slice * band.rate
    cursor = cap
  }
  return Math.round(owed)
}

export interface OtherDeduction {
  id: string
  name: string
  // Monthly pence.
  monthly: number
  // Pre-tax = salary sacrifice (reduces gross before tax & NI).
  // Post-tax = subtracted from take-home.
  preTax: boolean
}

export interface TaxInputs {
  annualGross: number // pence
  pensionPct: number // 0..100 of gross (salary sacrifice)
  otherDeductions: OtherDeduction[]
  cfg?: TaxYearConfig
}

export interface TaxBreakdown {
  // All annual pence figures.
  annualGross: number
  pensionAnnual: number
  otherPreTaxAnnual: number
  taxableGross: number // gross after pre-tax deductions
  incomeTaxAnnual: number
  niAnnual: number
  otherPostTaxAnnual: number
  netAnnual: number
  // Monthly = annual / 12, rounded to nearest pence.
  monthly: {
    gross: number
    pension: number
    otherPreTax: number
    taxableGross: number
    incomeTax: number
    ni: number
    otherPostTax: number
    net: number
  }
  // Effective tax + NI as % of gross (for display).
  effectiveRate: number
  cfgLabel: string
}

const monthlyOf = (annualPence: number) => Math.round(annualPence / 12)

export function calculateTakeHome(inputs: TaxInputs): TaxBreakdown {
  const cfg = inputs.cfg ?? UK_2025_26
  const annualGross = Math.max(0, Math.round(inputs.annualGross))
  const pensionPct = Math.min(100, Math.max(0, inputs.pensionPct))
  const pensionAnnual = Math.round((annualGross * pensionPct) / 100)

  const otherPreTaxMonthly = inputs.otherDeductions
    .filter((d) => d.preTax)
    .reduce((s, d) => s + Math.max(0, d.monthly), 0)
  const otherPostTaxMonthly = inputs.otherDeductions
    .filter((d) => !d.preTax)
    .reduce((s, d) => s + Math.max(0, d.monthly), 0)

  const otherPreTaxAnnual = otherPreTaxMonthly * 12
  const otherPostTaxAnnual = otherPostTaxMonthly * 12

  const taxableGross = Math.max(
    0,
    annualGross - pensionAnnual - otherPreTaxAnnual,
  )
  const incomeTaxAnnual = calcIncomeTax(taxableGross, cfg)
  const niAnnual = calcNI(taxableGross, cfg)

  const netAnnual = Math.max(
    0,
    taxableGross - incomeTaxAnnual - niAnnual - otherPostTaxAnnual,
  )

  const effectiveRate =
    annualGross > 0 ? (incomeTaxAnnual + niAnnual) / annualGross : 0

  return {
    annualGross,
    pensionAnnual,
    otherPreTaxAnnual,
    taxableGross,
    incomeTaxAnnual,
    niAnnual,
    otherPostTaxAnnual,
    netAnnual,
    monthly: {
      gross: monthlyOf(annualGross),
      pension: monthlyOf(pensionAnnual),
      otherPreTax: otherPreTaxMonthly,
      taxableGross: monthlyOf(taxableGross),
      incomeTax: monthlyOf(incomeTaxAnnual),
      ni: monthlyOf(niAnnual),
      otherPostTax: otherPostTaxMonthly,
      net: monthlyOf(netAnnual),
    },
    effectiveRate,
    cfgLabel: cfg.label,
  }
}
