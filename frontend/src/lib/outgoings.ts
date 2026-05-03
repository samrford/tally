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

// Schema-versioned plaintext shape — the JSON we encrypt/decrypt.
export interface OutgoingPlain {
  v: 1
  amount: number // pence (integer); avoids JS-float money drift
  category: Category
  description: string
  date: string // ISO YYYY-MM-DD
}

interface OutgoingAPI {
  id: string
  ciphertext: string
  created_at: string
  updated_at: string
}

export interface Outgoing extends OutgoingPlain {
  id: string
  createdAt: string
  updatedAt: string
}

const QUERY_KEY = ['outgoings'] as const

export function useOutgoings(dek: CryptoKey | null) {
  return useQuery({
    queryKey: QUERY_KEY,
    enabled: dek !== null,
    queryFn: async (): Promise<Outgoing[]> => {
      if (!dek) return []
      const rows = await apiFetch<OutgoingAPI[]>('/v1/outgoings')
      const decrypted = await Promise.all(
        rows.map(async (row) => {
          const plain = await decryptJSON<OutgoingPlain>(row.ciphertext, dek)
          return {
            ...plain,
            id: row.id,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          }
        }),
      )
      // Sort by date desc using the encrypted-internal date.
      return decrypted.sort((a, b) => b.date.localeCompare(a.date))
    },
  })
}

export function useCreateOutgoing(dek: CryptoKey | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (plain: Omit<OutgoingPlain, 'v'>) => {
      if (!dek) throw new Error('Locked')
      const record: OutgoingPlain = { v: 1, ...plain }
      const ciphertext = await encryptJSON(record, dek)
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
    mutationFn: async (args: {
      id: string
      plain: Omit<OutgoingPlain, 'v'>
    }) => {
      if (!dek) throw new Error('Locked')
      const record: OutgoingPlain = { v: 1, ...args.plain }
      const ciphertext = await encryptJSON(record, dek)
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
