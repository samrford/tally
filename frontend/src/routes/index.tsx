import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useAuth } from '@/lib/auth'

export const Route = createFileRoute('/')({
  beforeLoad: ({ context }) => {
    if (!context.auth.user) {
      throw redirect({ to: '/login' })
    }
  },
  component: HomePage,
})

function HomePage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate({ to: '/login' })
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[150px] pointer-events-none" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-accent/30 rounded-full blur-[150px] pointer-events-none" />

      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      <Card className="w-full max-w-md relative z-10">
        <CardHeader>
          <CardTitle>Hello, {user?.email}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            Welcome to Tally. There's nothing here yet — but soon there will be.
          </p>
          <Button
            variant="outline"
            onClick={handleSignOut}
            className="w-full"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
