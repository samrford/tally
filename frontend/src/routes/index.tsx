import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Calculator,
  LogOut,
  PiggyBank,
  Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ThemeToggle } from '@/components/ThemeToggle'
import { PageBackdrop } from '@/components/PageBackdrop'
import { useAuth } from '@/lib/auth'
import { useKeystore } from '@/lib/keystore'
import { requireUnlocked } from '@/lib/routeGuards'
import {
  useFlows,
  type FlowDirection,
  type RecurringFlow,
  type OneOffFlow,
} from '@/lib/flows'
import { amountForMonth, isActiveInMonth } from '@/lib/occurrences'
import { formatGBP } from '@/lib/format'

export const Route = createFileRoute('/')({
  beforeLoad: ({ context, location }) => requireUnlocked(context, location),
  component: DashboardPage,
})

function currentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function prettyMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function DashboardPage() {
  const { user, signOut } = useAuth()
  const { clearDek, dek } = useKeystore()
  const navigate = useNavigate()

  const { data, isLoading } = useFlows(dek)
  const ym = currentMonth()

  const totalForDirection = (direction: FlowDirection): number => {
    const flows = data ?? []
    const recurring = flows
      .filter(
        (f): f is RecurringFlow =>
          f.kind === 'recurring' && f.direction === direction,
      )
      .filter((r) => isActiveInMonth(r, ym))
      .reduce((s, r) => s + amountForMonth(r, ym).pence, 0)
    const oneOff = flows
      .filter(
        (f): f is OneOffFlow =>
          f.kind === 'one-off' && f.direction === direction,
      )
      .filter((o) => o.date.startsWith(ym))
      .reduce((s, o) => s + o.amount, 0)
    return recurring + oneOff
  }

  // Variable recurring items still showing their baseline estimate for this
  // month — i.e. user hasn't entered an actual override yet.
  const pendingEstimatesForDirection = (direction: FlowDirection): number => {
    const flows = data ?? []
    return flows
      .filter(
        (f): f is RecurringFlow =>
          f.kind === 'recurring' &&
          f.direction === direction &&
          f.variable === true,
      )
      .filter((r) => isActiveInMonth(r, ym))
      .filter((r) => r.overrides?.[ym] === undefined).length
  }

  const outgoingsTotal = totalForDirection('out')
  const incomeTotal = totalForDirection('in')
  const outgoingsPending = pendingEstimatesForDirection('out')
  const incomePending = pendingEstimatesForDirection('in')

  const handleSignOut = async () => {
    clearDek()
    await signOut()
    navigate({ to: '/login' })
  }

  return (
    <div className="min-h-screen p-4 relative overflow-hidden">
      <PageBackdrop />

      <div className="max-w-5xl mx-auto space-y-8 relative">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/tallylogotransp.png"
              alt="Tally"
              className="h-12 w-auto object-contain shrink-0"
            />
            <div>
              <h1 className="text-3xl font-bold leading-none">Tally</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Signed in as {user?.email}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <StatCard
            to="/outgoings"
            icon={<ArrowUpCircle className="h-10 w-10" />}
            title="Outgoings"
            total={outgoingsTotal}
            pendingEstimates={outgoingsPending}
            isLoading={isLoading}
            ym={ym}
          />
          <StatCard
            to="/income"
            icon={<ArrowDownCircle className="h-10 w-10" />}
            title="Income"
            total={incomeTotal}
            pendingEstimates={incomePending}
            isLoading={isLoading}
            ym={ym}
          />
          <ComingSoonCard
            icon={<PiggyBank className="h-10 w-10" />}
            title="Savings"
          />
          <ComingSoonCard
            icon={<Wallet className="h-10 w-10" />}
            title="Pension"
          />
        </div>

        <div>
          <Link to="/tax-calculator" className="block group">
            <Card className="transition-all group-hover:border-primary/50 group-hover:shadow-lg cursor-pointer">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="text-primary">
                  <Calculator className="h-7 w-7" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">Salary calculator</h3>
                  <p className="text-sm text-muted-foreground">
                    Work out take-home from gross salary, pension and other
                    deductions — then save it as recurring income.
                  </p>
                </div>
                <span className="text-xs uppercase tracking-wide text-muted-foreground hidden sm:block">
                  UK PAYE
                </span>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  to,
  icon,
  title,
  total,
  pendingEstimates,
  isLoading,
  ym,
}: {
  to: string
  icon: React.ReactNode
  title: string
  total: number
  pendingEstimates: number
  isLoading: boolean
  ym: string
}) {
  return (
    <Link to={to} className="block group">
      <Card className="h-full transition-all group-hover:border-primary/50 group-hover:shadow-lg cursor-pointer">
        <CardContent className="p-8 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="text-primary">{icon}</div>
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {prettyMonth(ym)}
            </span>
          </div>
          <h3 className="text-2xl font-semibold">{title}</h3>
          <div className="text-4xl font-bold tabular-nums">
            {isLoading ? (
              <span className="text-muted-foreground">—</span>
            ) : (
              formatGBP(total)
            )}
          </div>
          {pendingEstimates > 0 && (
            <div className="flex items-center gap-2 pt-1">
              <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold tabular-nums">
                {pendingEstimates}
              </span>
              <span className="text-xs text-muted-foreground">
                {pendingEstimates === 1
                  ? 'variable estimate to update'
                  : 'variable estimates to update'}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}

function ComingSoonCard({
  icon,
  title,
}: {
  icon: React.ReactNode
  title: string
}) {
  return (
    <Card className="h-full opacity-50">
      <CardContent className="p-8 space-y-4">
        <div className="text-muted-foreground">{icon}</div>
        <h3 className="text-2xl font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">Coming soon</p>
      </CardContent>
    </Card>
  )
}
