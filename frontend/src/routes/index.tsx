import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import {
  ArrowDownCircle,
  ArrowUpCircle,
  LogOut,
  PiggyBank,
  Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useAuth } from '@/lib/auth'
import { useKeystore } from '@/lib/keystore'
import { requireUnlocked } from '@/lib/routeGuards'

export const Route = createFileRoute('/')({
  beforeLoad: ({ context }) => requireUnlocked(context),
  component: DashboardPage,
})

function DashboardPage() {
  const { user, signOut } = useAuth()
  const { clearDek } = useKeystore()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    clearDek()
    await signOut()
    navigate({ to: '/login' })
  }

  return (
    <div className="min-h-screen p-4 relative overflow-hidden">
      <div className="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[150px] pointer-events-none" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-accent/20 rounded-full blur-[150px] pointer-events-none" />

      <div className="max-w-5xl mx-auto space-y-8 relative">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Tally</h1>
            <p className="text-sm text-muted-foreground">
              Signed in as {user?.email}
            </p>
          </div>
          <div className="flex gap-2">
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link to="/outgoings" className="block group">
            <Card className="h-full transition-all group-hover:border-primary/50 group-hover:shadow-lg cursor-pointer">
              <CardContent className="pt-6 space-y-2">
                <div className="text-primary">
                  <ArrowUpCircle className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-semibold">Outgoings</h3>
                <p className="text-sm text-muted-foreground">
                  Recurring bills and monthly one-offs
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link to="/income" className="block group">
            <Card className="h-full transition-all group-hover:border-primary/50 group-hover:shadow-lg cursor-pointer">
              <CardContent className="pt-6 space-y-2">
                <div className="text-primary">
                  <ArrowDownCircle className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-semibold">Income</h3>
                <p className="text-sm text-muted-foreground">
                  Salary, freelance, and one-offs
                </p>
              </CardContent>
            </Card>
          </Link>
          <ComingSoonCard
            icon={<PiggyBank className="h-8 w-8" />}
            title="Savings"
          />
          <ComingSoonCard
            icon={<Wallet className="h-8 w-8" />}
            title="Pension"
          />
        </div>
      </div>
    </div>
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
      <CardContent className="pt-6 space-y-2">
        <div className="text-muted-foreground">{icon}</div>
        <h3 className="text-xl font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">Coming soon</p>
      </CardContent>
    </Card>
  )
}
