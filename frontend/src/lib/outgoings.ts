import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { encryptJSON, decryptJSON } from '@/lib/crypto'
import { apiFetch } from '@/lib/api'

export type Category = 'rent' | 'bills' | 'loans' | 'food' | 'fun' | 'other'

export const CATEGORIES: Category[] = [
  'rent',
  'bills',
  'loans',
  'food',
  'fun',
  'other',
]

export type FrequencyUnit = 'week' | 'month'

export interface Frequency {
  period: number // ≥ 1
  unit: FrequencyUnit
}

// --- Plaintext shapes (what we encrypt/decrypt) -----------------------------

export interface RecurringPlain {
  kind: 'recurring'
  name: string
  amount: number // pence; per-occurrence baseline
  category: Category
  frequency: Frequency
  startDate: string // YYYY-MM-DD
  endDate?: string // YYYY-MM-DD; absent = open-ended
  variable?: boolean
  overrides?: Record<string, number> // 'YYYY-MM' → total pence for that month
}

export interface OneOffPlain {
  kind: 'one-off'
  name: string
  amount: number // pence
  category: Category
  date: string // YYYY-MM-DD
}

export type OutgoingPlain = RecurringPlain | OneOffPlain

// --- With server metadata ---------------------------------------------------

interface Meta {
  id: string
  createdAt: string
  updatedAt: string
}

export type RecurringOutgoing = RecurringPlain & Meta
export type OneOffOutgoing = OneOffPlain & Meta
export type Outgoing = RecurringOutgoing | OneOffOutgoing

// --- Wire format ------------------------------------------------------------

interface OutgoingAPI {
  id: string
  ciphertext: string
  created_at: string
  updated_at: string
}

const QUERY_KEY = ['outgoings'] as const

// --- Queries ----------------------------------------------------------------

export function useOutgoings(dek: CryptoKey | null) {
  return useQuery({
    queryKey: QUERY_KEY,
    enabled: dek !== null,
    queryFn: async (): Promise<Outgoing[]> => {
      if (!dek) return []
      const rows = await apiFetch<OutgoingAPI[]>('/v1/outgoings')
      const decrypted: Outgoing[] = []
      for (const row of rows) {
        try {
          const plain = await decryptJSON<OutgoingPlain>(row.ciphertext, dek)
          decrypted.push({
            ...plain,
            id: row.id,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          } as Outgoing)
        } catch (err) {
          // Skip undecryptable rows rather than blowing up the whole list.
          console.warn('[outgoings] failed to decrypt row', row.id, err)
        }
      }
      return decrypted
    },
  })
}

export function useCreateOutgoing(dek: CryptoKey | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (plain: OutgoingPlain) => {
      if (!dek) throw new Error('Locked')
      const ciphertext = await encryptJSON(plain, dek)
      return apiFetch<OutgoingAPI>('/v1/outgoings', {
        method: 'POST',
        body: JSON.stringify({ ciphertext }),
      })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useUpdateOutgoing(dek: CryptoKey | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args: { id: string; plain: OutgoingPlain }) => {
      if (!dek) throw new Error('Locked')
      const ciphertext = await encryptJSON(args.plain, dek)
      return apiFetch<OutgoingAPI>(`/v1/outgoings/${args.id}`, {
        method: 'PUT',
        body: JSON.stringify({ ciphertext }),
      })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useDeleteOutgoing() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      return apiFetch(`/v1/outgoings/${id}`, { method: 'DELETE' })
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
