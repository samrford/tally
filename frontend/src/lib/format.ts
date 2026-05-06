// Shared formatting helpers — keep currency display + date encoding
// consistent across the app. All money is in pence (integer).

const gbp = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
})

const gbpRounded = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  maximumFractionDigits: 0,
})

export const formatGBP = (pence: number): string => gbp.format(pence / 100)

// For places where decimals are noise (e.g. annual /yr labels next to a
// monthly figure that already shows the precise amount).
export const formatGBPRounded = (pence: number): string =>
  gbpRounded.format(pence / 100)

// Local-date YYYY-MM-DD for "today". Avoids UTC-vs-local off-by-one when
// using ISO timestamps near midnight.
export function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}
