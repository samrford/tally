import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
const cookieDomain = import.meta.env.VITE_AUTH_COOKIE_DOMAIN

if (!url || !key) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY')
}

// Cross-app session sharing: when VITE_AUTH_COOKIE_DOMAIN is set (e.g.
// ".samford.uk") AND the current host falls under that domain, store the
// Supabase session in cookies scoped to the parent domain so sibling apps
// read the same session. Otherwise Supabase falls back to its default
// localStorage and signin stays per-app.
//
// Sessions with OAuth provider tokens routinely exceed the 4KB single-cookie
// limit, so values are chunked across `<name>.0`, `<name>.1`, ... cookies.

function shouldUseCookieStorage(): boolean {
  if (typeof window === 'undefined') return false
  if (!cookieDomain) return false
  const host = window.location.hostname
  const bare = cookieDomain.startsWith('.')
    ? cookieDomain.slice(1)
    : cookieDomain
  return host === bare || host.endsWith('.' + bare)
}

const CHUNK_SIZE = 2800 // unencoded; URL-encoding inflation keeps us under 4KB
const MAX_CHUNKS = 20 // sanity cap; covers ~56KB
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

function readRawCookie(name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = document.cookie.match(
    new RegExp('(?:^|;\\s*)' + escaped + '=([^;]+)'),
  )
  return match ? decodeURIComponent(match[1]) : null
}

function writeRawCookie(name: string, value: string, maxAge: number): void {
  document.cookie = `${name}=${encodeURIComponent(value)}; Domain=${cookieDomain}; Path=/; Secure; SameSite=Lax; max-age=${maxAge}`
}

function deleteRawCookie(name: string): void {
  document.cookie = `${name}=; Domain=${cookieDomain}; Path=/; max-age=0`
}

function clearChunks(name: string, fromIndex = 0): void {
  for (let i = fromIndex; i < MAX_CHUNKS; i++) {
    if (readRawCookie(`${name}.${i}`) === null) break
    deleteRawCookie(`${name}.${i}`)
  }
}

const cookieStorage = {
  getItem(name: string): string | null {
    // Single-cookie value (small enough to not need chunking)
    const single = readRawCookie(name)
    if (single !== null) return single

    // Chunked: name.0, name.1, ...
    let assembled = ''
    let i = 0
    for (; i < MAX_CHUNKS; i++) {
      const chunk = readRawCookie(`${name}.${i}`)
      if (chunk === null) break
      assembled += chunk
    }
    return i > 0 ? assembled : null
  },

  setItem(name: string, value: string): void {
    if (value.length <= CHUNK_SIZE) {
      writeRawCookie(name, value, COOKIE_MAX_AGE)
      clearChunks(name) // wipe any larger previous value's leftover chunks
      return
    }

    // Wipe a previous single-cookie write (if value used to be small)
    if (readRawCookie(name) !== null) deleteRawCookie(name)

    const numChunks = Math.ceil(value.length / CHUNK_SIZE)
    for (let i = 0; i < numChunks; i++) {
      const piece = value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
      writeRawCookie(`${name}.${i}`, piece, COOKIE_MAX_AGE)
    }
    clearChunks(name, numChunks) // wipe any further leftover chunks
  },

  removeItem(name: string): void {
    deleteRawCookie(name)
    clearChunks(name)
  },
}

export const supabase = createClient(url, key, {
  auth: {
    ...(shouldUseCookieStorage() ? { storage: cookieStorage } : {}),
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
})
