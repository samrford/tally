import { redirect } from '@tanstack/react-router'
import type { AuthContextType } from '@/lib/auth'
import type { KeystoreContextType } from '@/lib/keystore'

export interface RouterContext {
  auth: AuthContextType
  keystore: KeystoreContextType
}

// Require a signed-in Supabase user. Redirects to /login if not.
export function requireAuth(context: RouterContext): void {
  if (!context.auth.user) throw redirect({ to: '/login' })
}

// Full guard for app pages: signed in, key set up, DEK loaded.
// hasKeySetup is guaranteed non-null at this point because InnerApp
// blocks rendering the router until keystore is settled.
export function requireUnlocked(context: RouterContext): void {
  requireAuth(context)
  if (context.keystore.hasKeySetup === false) {
    throw redirect({ to: '/setup-passphrase' })
  }
  if (!context.keystore.dek) {
    throw redirect({ to: '/unlock' })
  }
}
