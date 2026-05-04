import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import {
  importDek,
  bytesToBase64Public,
  base64ToBytesPublic,
  type WrappedKeyMaterialB64,
} from '@/lib/crypto'
import { apiFetch, ApiError } from '@/lib/api'
import { supabase } from '@/lib/supabase'

const SESSION_KEY = 'tally-dek'

// API uses snake_case; we expose camelCase to the rest of the app.
interface UserKeyAPI {
  wrapped_dek: string
  salt: string
  iterations: number
}

async function fetchWrappedKey(): Promise<WrappedKeyMaterialB64> {
  const api = await apiFetch<UserKeyAPI>('/v1/me/key')
  return {
    wrappedDek: api.wrapped_dek,
    salt: api.salt,
    iterations: api.iterations,
  }
}

export async function postWrappedKey(
  material: WrappedKeyMaterialB64,
): Promise<void> {
  await apiFetch('/v1/me/key', {
    method: 'POST',
    body: JSON.stringify({
      wrapped_dek: material.wrappedDek,
      salt: material.salt,
      iterations: material.iterations,
    }),
  })
}

export interface KeystoreContextType {
  dek: CryptoKey | null
  hasKeySetup: boolean | null // null = unknown (still checking)
  isCheckingKey: boolean
  setDek(rawBytes: Uint8Array<ArrayBuffer>): Promise<void>
  clearDek(): void
  fetchWrappedKey(): Promise<WrappedKeyMaterialB64>
  refreshKeyStatus(): Promise<void>
}

const KeystoreContext = createContext<KeystoreContextType>({
  dek: null,
  hasKeySetup: null,
  isCheckingKey: false,
  setDek: async () => {},
  clearDek: () => {},
  fetchWrappedKey: async () => {
    throw new Error('not in provider')
  },
  refreshKeyStatus: async () => {},
})

export function useKeystore() {
  return useContext(KeystoreContext)
}

export function KeystoreProvider({ children }: { children: ReactNode }) {
  const [dek, setDekState] = useState<CryptoKey | null>(null)
  const [hasKeySetup, setHasKeySetup] = useState<boolean | null>(null)
  const [isCheckingKey, setIsCheckingKey] = useState(false)

  const refreshKeyStatus = useCallback(async () => {
    setIsCheckingKey(true)
    try {
      const { data } = await supabase.auth.getSession()
      if (!data.session) {
        setHasKeySetup(null)
        return
      }
      try {
        await fetchWrappedKey()
        setHasKeySetup(true)
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          setHasKeySetup(false)
        } else {
          console.error('[keystore] refreshKeyStatus failed:', err)
        }
      }
    } finally {
      setIsCheckingKey(false)
    }
  }, [])

  // Restore DEK from sessionStorage on mount.
  useEffect(() => {
    const saved = sessionStorage.getItem(SESSION_KEY)
    if (!saved) return
    const bytes = base64ToBytesPublic(saved)
    importDek(bytes)
      .then(setDekState)
      .catch((err) => {
        console.warn('[keystore] failed to restore DEK, clearing:', err)
        sessionStorage.removeItem(SESSION_KEY)
      })
  }, [])

  // Track auth state — clear DEK on sign-out, re-check key status on sign-in.
  // We narrow to SIGNED_IN and INITIAL_SESSION (rather than "any event with a
  // session") because TOKEN_REFRESHED and USER_UPDATED also carry a session
  // but don't affect the wrapped key — re-fetching on those just spams the API.
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        sessionStorage.removeItem(SESSION_KEY)
        setDekState(null)
        setHasKeySetup(null)
        return
      }
      if (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
        refreshKeyStatus()
      }
    })
    return () => subscription.unsubscribe()
  }, [refreshKeyStatus])

  const setDek = useCallback(async (rawBytes: Uint8Array<ArrayBuffer>) => {
    sessionStorage.setItem(SESSION_KEY, bytesToBase64Public(rawBytes))
    const key = await importDek(rawBytes)
    setDekState(key)
    setHasKeySetup(true)
  }, [])

  const clearDek = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY)
    setDekState(null)
  }, [])

  return (
    <KeystoreContext.Provider
      value={{
        dek,
        hasKeySetup,
        isCheckingKey,
        setDek,
        clearDek,
        fetchWrappedKey,
        refreshKeyStatus,
      }}
    >
      {children}
    </KeystoreContext.Provider>
  )
}
