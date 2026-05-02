import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
const cookieDomain = import.meta.env.VITE_AUTH_COOKIE_DOMAIN

if (!url || !key) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY')
}

// Cross-app session sharing: when VITE_AUTH_COOKIE_DOMAIN is set (e.g.
// ".samrford.com") AND the current host falls under that domain, store the
// Supabase session in a cookie scoped to the parent domain so sibling apps
// read the same session. Otherwise (env unset, localhost, *.fly.dev) we
// omit `storage` and Supabase falls back to its default localStorage,
// keeping signin per-app.

function shouldUseCookieStorage(): boolean {
  if (typeof window === 'undefined') return false
  if (!cookieDomain) return false
  const host = window.location.hostname
  const bare = cookieDomain.startsWith('.')
    ? cookieDomain.slice(1)
    : cookieDomain
  return host === bare || host.endsWith('.' + bare)
}

const cookieStorage = {
  getItem(name: string): string | null {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const match = document.cookie.match(
      new RegExp('(?:^|;\\s*)' + escaped + '=([^;]+)'),
    )
    return match ? decodeURIComponent(match[1]) : null
  },
  setItem(name: string, value: string): void {
    const maxAge = 60 * 60 * 24 * 30 // 30 days
    document.cookie = `${name}=${encodeURIComponent(value)}; Domain=${cookieDomain}; Path=/; Secure; SameSite=Lax; max-age=${maxAge}`
  },
  removeItem(name: string): void {
    document.cookie = `${name}=; Domain=${cookieDomain}; Path=/; max-age=0`
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
