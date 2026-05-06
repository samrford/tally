import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { Loader2, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ThemeToggle } from '@/components/ThemeToggle'
import { PageBackdrop } from '@/components/PageBackdrop'
import { unwrapDek } from '@/lib/crypto'
import { useKeystore } from '@/lib/keystore'
import { safeNext } from '@/lib/routeGuards'

export const Route = createFileRoute('/unlock')({
  validateSearch: (search): { next?: string } => ({
    next: safeNext(search.next),
  }),
  beforeLoad: ({ context, search }) => {
    if (!context.auth.user) {
      throw redirect({ to: '/login', search: { next: search.next } })
    }
    if (context.keystore.hasKeySetup === false) {
      throw redirect({ to: '/setup-passphrase' })
    }
    if (context.keystore.dek) {
      throw redirect({ to: search.next ?? '/' })
    }
  },
  component: UnlockPage,
})

function UnlockPage() {
  const navigate = useNavigate()
  const keystore = useKeystore()
  const { next } = Route.useSearch()
  const [passphrase, setPassphrase] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const wrapped = await keystore.fetchWrappedKey()
      const dekBytes = await unwrapDek(passphrase, wrapped)
      await keystore.setDek(dekBytes)
      navigate({ to: next ?? '/' })
    } catch (err) {
      // AES-GCM auth tag mismatch on wrong passphrase throws here
      console.error('[unlock]', err)
      setError('Wrong passphrase. Try again.')
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <PageBackdrop variant="auth" />

      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      <Card className="w-full max-w-md relative z-10">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-2">
            <div className="rounded-full bg-primary/10 p-3">
              <Lock className="h-6 w-6 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl text-center">Unlock Tally</CardTitle>
          <CardDescription className="text-center">
            Enter your data passphrase to view your finances.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="passphrase">Passphrase</Label>
              <Input
                id="passphrase"
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                required
                autoComplete="current-password"
                autoFocus
              />
              {error && (
                <p className="text-sm text-destructive mt-1">{error}</p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Unlock
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
