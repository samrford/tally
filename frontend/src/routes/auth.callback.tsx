import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export const Route = createFileRoute('/auth/callback')({
  component: AuthCallbackPage,
})

function AuthCallbackPage() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    // Listen for SIGNED_IN explicitly so we navigate exactly when the PKCE
    // code exchange lands, not earlier
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[auth/callback] event:', event, 'hasSession:', !!session)
      if (cancelled) return
      if (event === 'SIGNED_IN' && session) {
        navigate({ to: '/' })
      }
    })

    // Also probe immediately — if the SDK already exchanged the code before
    // we mounted (detectSessionInUrl runs eagerly), navigate now.
    supabase.auth.getSession().then(({ data, error }) => {
      console.log('[auth/callback] getSession:', {
        hasSession: !!data.session,
        error: error?.message,
      })
      if (cancelled) return
      if (error) {
        setError(error.message)
        return
      }
      if (data.session) {
        navigate({ to: '/' })
      }
    })

    // Hard timeout so we don't spin forever — surface a useful error instead.
    const timer = window.setTimeout(() => {
      if (cancelled) return
      setError(
        'Session never established. Most likely cause: the redirect URL ' +
          'isn’t in Supabase’s allow-list, or cookies on .samford.uk aren’t ' +
          'being set. Check the browser console + Application > Cookies tab.',
      )
    }, 8000)

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
      window.clearTimeout(timer)
    }
  }, [navigate])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md text-center space-y-3">
          <p className="text-destructive font-semibold">
            Sign-in didn’t complete
          </p>
          <p className="text-sm text-muted-foreground">{error}</p>
          <button
            onClick={() => navigate({ to: '/login' })}
            className="text-primary underline text-sm"
          >
            Back to login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )
}
