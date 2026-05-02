import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/auth'

export const Route = createFileRoute('/auth/callback')({
  component: AuthCallbackPage,
})

function AuthCallbackPage() {
  const { user, isLoading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (isLoading) return
    navigate({ to: user ? '/' : '/login' })
  }, [isLoading, user, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )
}
