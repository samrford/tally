import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { Loader2, KeyRound, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
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
import { generateAndWrapDek } from '@/lib/crypto'
import { postWrappedKey, useKeystore } from '@/lib/keystore'

export const Route = createFileRoute('/setup-passphrase')({
  beforeLoad: ({ context }) => {
    if (!context.auth.user) throw redirect({ to: '/login' })
    if (context.keystore.hasKeySetup) {
      throw redirect({ to: context.keystore.dek ? '/' : '/unlock' })
    }
  },
  component: SetupPassphrasePage,
})

const MIN_LENGTH = 8

function SetupPassphrasePage() {
  const navigate = useNavigate()
  const keystore = useKeystore()
  const [passphrase, setPassphrase] = useState('')
  const [confirm, setConfirm] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (passphrase.length < MIN_LENGTH) {
      toast.error(`Passphrase must be at least ${MIN_LENGTH} characters`)
      return
    }
    if (passphrase !== confirm) {
      toast.error('Passphrases do not match')
      return
    }

    setIsLoading(true)
    try {
      const { dekBytes, wrapped } = await generateAndWrapDek(passphrase)
      await postWrappedKey(wrapped)
      await keystore.setDek(dekBytes)
      navigate({ to: '/' })
    } catch (err) {
      console.error('[setup-passphrase]', err)
      toast.error('Could not save passphrase. Please try again.')
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
              <KeyRound className="h-6 w-6 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl text-center">
            Set your data passphrase
          </CardTitle>
          <CardDescription className="text-center">
            This encrypts everything you put into Tally. It is separate from
            your login.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 flex gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-destructive">
                Write this down somewhere safe.
              </p>
              <p className="text-muted-foreground mt-1">
                If you forget it, your data cannot be recovered - your data is encrypted end to end, meaning not even the developers can access it. 
                There is no reset.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="passphrase">Passphrase</Label>
              <Input
                id="passphrase"
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="At least 8 characters"
                required
                minLength={MIN_LENGTH}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="confirm">Confirm passphrase</Label>
              <Input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Type it again"
                required
                minLength={MIN_LENGTH}
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Continue
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
