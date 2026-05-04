import { createFileRoute } from '@tanstack/react-router'
import { MonthlyFlowsView } from '@/components/MonthlyFlowsView'
import { OUTGOING_CATEGORIES } from '@/lib/flows'
import { requireUnlocked } from '@/lib/routeGuards'

export const Route = createFileRoute('/outgoings')({
  beforeLoad: ({ context, location }) => requireUnlocked(context, location),
  component: OutgoingsPage,
})

function OutgoingsPage() {
  return (
    <MonthlyFlowsView
      direction="out"
      title="Outgoings"
      categories={OUTGOING_CATEGORIES}
    />
  )
}
