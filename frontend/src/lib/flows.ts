import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { encryptJSON, decryptJSON } from '@/lib/crypto'
import { apiFetch } from '@/lib/api'

// --- Direction --------------------------------------------------------------

export type FlowDirection = 'in' | 'out'

// --- Categories -------------------------------------------------------------

export const OUTGOING_CATEGORIES = [
  'rent',
  'bills',
  'loans',
  'food',
  'fun',
  'other',
] as const

export const INCOME_CATEGORIES = [
  'salary',
  'freelance',
  'bonus',
  'dividend',
  'refund',
  'gift',
  'other',
] as const

export type OutgoingCategory = (typeof OUTGOING_CATEGORIES)[number]
export type IncomeCategory = (typeof INCOME_CATEGORIES)[number]
export type Category = OutgoingCategory | IncomeCategory

// --- Frequency --------------------------------------------------------------

export type FrequencyUnit = 'week' | 'month'

export interface Frequency {
  period: number // ≥ 1
  unit: FrequencyUnit
}

// --- Deductions (income only, optional, hooked up by the future tax engine) -

export type DeductionType =
  | 'tax'
  | 'ni'
  | 'pension'
  | 'student_loan'
  | 'other'

export interface Deduction {
  name: string // 'Income Tax', 'NI Cat A', 'Pension 5%', etc.
  amount: number // pence; positive value reduces gross
  type: DeductionType
}

// --- Plaintext shapes (what we encrypt/decrypt) -----------------------------

export interface RecurringPlain {
  kind: 'recurring'
  direction: FlowDirection
  name: string
  amount: number // pence; per-occurrence baseline (gross, when direction='in')
  category: Category
  frequency: Frequency
  startDate: string // YYYY-MM-DD
  endDate?: string // YYYY-MM-DD; absent = open-ended
  variable?: boolean
  overrides?: Record<string, number> // 'YYYY-MM' → total pence for that month
  // Income-only fields below — future tax engine reads/derives these.
  deductions?: Deduction[]
  taxable?: boolean
}

export interface OneOffPlain {
  kind: 'one-off'
  direction: FlowDirection
  name: string
  amount: number // pence (gross, when direction='in')
  category: Category
  date: string // YYYY-MM-DD
  // Income-only fields.
  deductions?: Deduction[]
  taxable?: boolean
}

export type FlowPlain = RecurringPlain | OneOffPlain

// --- With server metadata ---------------------------------------------------

interface Meta {
  id: string
  createdAt: string
  updatedAt: string
}

export type RecurringFlow = RecurringPlain & Meta
export type OneOffFlow = OneOffPlain & Meta
export type Flow = RecurringFlow | OneOffFlow

// --- Wire format ------------------------------------------------------------

interface FlowAPI {
  id: string
  ciphertext: string
  created_at: string
  updated_at: string
}

const QUERY_KEY = ['flows'] as const

// --- Queries ----------------------------------------------------------------

export function useFlows(dek: CryptoKey | null) {
  return useQuery({
    queryKey: QUERY_KEY,
    enabled: dek !== null,
    queryFn: async (): Promise<Flow[]> => {
      if (!dek) return []
      const rows = await apiFetch<FlowAPI[]>('/v1/flows')
      const decrypted: Flow[] = []
      for (const row of rows) {
        try {
          const plain = await decryptJSON<FlowPlain>(row.ciphertext, dek)
          decrypted.push({
            ...plain,
            id: row.id,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          } as Flow)
        } catch (err) {
          // Skip undecryptable rows rather than blowing up the whole list.
          console.warn('[flows] failed to decrypt row', row.id, err)
        }
      }
      return decrypted
    },
  })
}

export function useCreateFlow(dek: CryptoKey | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (plain: FlowPlain) => {
      if (!dek) throw new Error('Locked')
      const ciphertext = await encryptJSON(plain, dek)
      return apiFetch<FlowAPI>('/v1/flows', {
        method: 'POST',
        body: JSON.stringify({ ciphertext }),
      })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useUpdateFlow(dek: CryptoKey | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args: { id: string; plain: FlowPlain }) => {
      if (!dek) throw new Error('Locked')
      const ciphertext = await encryptJSON(args.plain, dek)
      return apiFetch<FlowAPI>(`/v1/flows/${args.id}`, {
        method: 'PUT',
        body: JSON.stringify({ ciphertext }),
      })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useDeleteFlow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      return apiFetch(`/v1/flows/${id}`, { method: 'DELETE' })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

// --- Display helpers --------------------------------------------------------

export function frequencyLabel(f: Frequency): string {
  if (f.unit === 'week') {
    if (f.period === 1) return 'Weekly'
    if (f.period === 2) return 'Fortnightly'
    return `Every ${f.period} weeks`
  }
  if (f.period === 1) return 'Monthly'
  if (f.period === 12) return 'Yearly'
  return `Every ${f.period} months`
}

// Net amount for an income flow occurrence (gross minus declared deductions).
// For non-income flows or those without deductions, this is just the amount.
export function netAmount(plain: { amount: number; deductions?: Deduction[] }): number {
  if (!plain.deductions || plain.deductions.length === 0) return plain.amount
  const total = plain.deductions.reduce((sum, d) => sum + d.amount, 0)
  return Math.max(0, plain.amount - total)
}
