import { redirect, type ParsedLocation } from '@tanstack/react-router'
import type { AuthContextType } from '@/lib/auth'
import type { KeystoreContextType } from '@/lib/keystore'

export interface RouterContext {
  auth: AuthContextType
  keystore: KeystoreContextType
}

// Only allow same-origin paths through ?next= to prevent open-redirect tricks.
export function safeNext(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length === 0) return undefined
  if (!value.startsWith('/') || value.startsWith('//')) return undefined
  return value
}

// Require a signed-in Supabase user. Redirects to /login if not, preserving
// the current URL as ?next= so we can return after sign-in.
export function requireAuth(
  context: RouterContext,
  location?: ParsedLocation,
): void {
  if (!context.auth.user) {
    throw redirect({
      to: '/login',
      search: location?.href ? { next: location.href } : undefined,
    })
  }
}

// Full guard for app pages: signed in, key set up, DEK loaded.
// hasKeySetup is guaranteed non-null at this point because InnerApp
// blocks rendering the router until keystore is settled.
export function requireUnlocked(
  context: RouterContext,
  location?: ParsedLocation,
): void {
  requireAuth(context, location)
  if (context.keystore.hasKeySetup === false) {
    throw redirect({ to: '/setup-passphrase' })
  }
  if (!context.keystore.dek) {
    throw redirect({
      to: '/unlock',
      search: location?.href ? { next: location.href } : undefined,
    })
  }
}
