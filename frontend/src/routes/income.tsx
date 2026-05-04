import { createFileRoute } from '@tanstack/react-router'
import { MonthlyFlowsView } from '@/components/MonthlyFlowsView'
import { INCOME_CATEGORIES } from '@/lib/flows'
import { requireUnlocked } from '@/lib/routeGuards'

export const Route = createFileRoute('/income')({
  beforeLoad: ({ context }) => requireUnlocked(context),
  component: IncomePage,
})

function IncomePage() {
  return (
    <MonthlyFlowsView
      direction="in"
      title="Income"
      categories={INCOME_CATEGORIES}
    />
  )
}
