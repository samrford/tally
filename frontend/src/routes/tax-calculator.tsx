import { createFileRoute } from '@tanstack/react-router'
import { TaxCalculatorPage } from '@/components/TaxCalculator'
import { requireUnlocked } from '@/lib/routeGuards'

export const Route = createFileRoute('/tax-calculator')({
  beforeLoad: ({ context, location }) => requireUnlocked(context, location),
  component: TaxCalculatorPage,
})
