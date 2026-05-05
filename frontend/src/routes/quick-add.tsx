import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { ArrowDownCircle, ArrowUpCircle, CheckCircle2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ThemeToggle } from '@/components/ThemeToggle'
import { PageBackdrop } from '@/components/PageBackdrop'
import { OneOffForm } from '@/components/OneOffForm'
import { RecurringForm } from '@/components/RecurringForm'
import { cn } from '@/lib/utils'
import {
  useCreateFlow,
  OUTGOING_CATEGORIES,
  INCOME_CATEGORIES,
  type FlowDirection,
} from '@/lib/flows'
import { useKeystore } from '@/lib/keystore'
import { requireUnlocked } from '@/lib/routeGuards'
import { formatGBP } from '@/lib/format'

export const Route = createFileRoute('/quick-add')({
  beforeLoad: ({ context, location }) => requireUnlocked(context, location),
  component: QuickAddPage,
})

type Kind = 'one-off' | 'recurring'

function QuickAddPage() {
  const { dek } = useKeystore()
  const navigate = useNavigate()
  const create = useCreateFlow(dek)

  const [direction, setDirection] = useState<FlowDirection>('out')
  const [kind, setKind] = useState<Kind>('one-off')
  const [justAdded, setJustAdded] = useState<{
    name: string
    amount: number
    direction: FlowDirection
    kind: Kind
  } | null>(null)

  const categories =
    direction === 'out' ? OUTGOING_CATEGORIES : INCOME_CATEGORIES

  const goHome = () => navigate({ to: '/' })

  return (
    <main className="min-h-screen flex flex-col p-4 relative overflow-hidden">
      <PageBackdrop />

      <header className="flex items-center justify-between mb-4 relative">
        <div className="text-sm text-muted-foreground">Quick add</div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Button asChild variant="ghost" size="icon" aria-label="Close">
            <Link to="/">
              <X className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </header>

      <div className="flex-1 flex items-start sm:items-center justify-center relative">
        <Card className="w-full max-w-md">
          {justAdded ? (
            <SuccessPanel
              added={justAdded}
              onAddAnother={() => setJustAdded(null)}
              onDone={goHome}
            />
          ) : (
            <>
              <CardHeader>
                <CardTitle className="text-xl">
                  Add {direction === 'out' ? 'outgoing' : 'income'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-2 gap-2">
                  <SegmentButton
                    active={direction === 'out'}
                    onClick={() => setDirection('out')}
                    icon={<ArrowUpCircle className="h-4 w-4" />}
                    label="Out"
                  />
                  <SegmentButton
                    active={direction === 'in'}
                    onClick={() => setDirection('in')}
                    icon={<ArrowDownCircle className="h-4 w-4" />}
                    label="In"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <SegmentButton
                    active={kind === 'one-off'}
                    onClick={() => setKind('one-off')}
                    label="One-off"
                  />
                  <SegmentButton
                    active={kind === 'recurring'}
                    onClick={() => setKind('recurring')}
                    label="Recurring"
                  />
                </div>

                {kind === 'one-off' ? (
                  <OneOffForm
                    // Re-mount when direction changes so category default refreshes
                    key={`one-off-${direction}`}
                    categories={categories}
                    cancelLabel="Done"
                    isLoading={create.isPending}
                    onCancel={goHome}
                    onSubmit={async (plain) => {
                      await create.mutateAsync({
                        kind: 'one-off',
                        direction,
                        ...plain,
                      })
                      setJustAdded({
                        name: plain.name,
                        amount: plain.amount,
                        direction,
                        kind: 'one-off',
                      })
                    }}
                  />
                ) : (
                  <RecurringForm
                    key={`recurring-${direction}`}
                    categories={categories}
                    cancelLabel="Done"
                    isLoading={create.isPending}
                    onCancel={goHome}
                    onSubmit={async (plain) => {
                      await create.mutateAsync({
                        kind: 'recurring',
                        direction,
                        ...plain,
                      })
                      setJustAdded({
                        name: plain.name,
                        amount: plain.amount,
                        direction,
                        kind: 'recurring',
                      })
                    }}
                  />
                )}
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </main>
  )
}

function SegmentButton({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean
  onClick: () => void
  label: string
  icon?: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center gap-2 h-10 rounded-md border text-sm font-medium transition-colors',
        active
          ? 'bg-primary text-primary-foreground border-primary'
          : 'bg-card text-foreground border-input hover:bg-accent/40',
      )}
      aria-pressed={active}
    >
      {icon}
      {label}
    </button>
  )
}

function SuccessPanel({
  added,
  onAddAnother,
  onDone,
}: {
  added: { name: string; amount: number; direction: FlowDirection; kind: Kind }
  onAddAnother: () => void
  onDone: () => void
}) {
  const noun = added.direction === 'out' ? 'outgoing' : 'income'
  const kindLabel = added.kind === 'one-off' ? 'One-off' : 'Recurring'

  return (
    <CardContent className="py-10 flex flex-col items-center text-center space-y-5">
      <div className="rounded-full bg-primary/10 p-3">
        <CheckCircle2 className="h-8 w-8 text-primary" />
      </div>
      <div className="space-y-1">
        <p className="text-lg font-semibold">Saved</p>
        <p className="text-sm text-muted-foreground">
          {kindLabel} {noun}:{' '}
          <span className="font-medium text-foreground">{added.name}</span> ·{' '}
          <span className="tabular-nums">{formatGBP(added.amount)}</span>
        </p>
      </div>
      <div className="flex flex-col-reverse sm:flex-row gap-2 w-full sm:justify-center">
        <Button variant="ghost" onClick={onDone}>
          Done
        </Button>
        <Button onClick={onAddAnother}>Add another</Button>
      </div>
    </CardContent>
  )
}
