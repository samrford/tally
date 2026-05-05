import { useMemo, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import toast from 'react-hot-toast'
import { ArrowLeft, Calculator, Loader2, Wallet } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ThemeToggle } from '@/components/ThemeToggle'
import { PageBackdrop } from '@/components/PageBackdrop'
import { TaxCalculatorInputs } from '@/components/TaxCalculatorInputs'
import { TaxCalculatorBreakdown } from '@/components/TaxCalculatorBreakdown'
import { useKeystore } from '@/lib/keystore'
import { formatGBP, todayISO } from '@/lib/format'
import {
  useCreateFlow,
  type Deduction,
  type RecurringPlain,
} from '@/lib/flows'
import {
  calculateTakeHome,
  type OtherDeduction,
  type TaxBreakdown,
} from '@/lib/uk-tax'

let nextId = 0
const newId = () => `d${++nextId}`

const parseAnnualGross = (s: string): number => {
  const n = parseFloat(s)
  if (!isFinite(n) || n < 0) return 0
  return Math.round(n * 100)
}

const parsePensionPct = (s: string): number => {
  const n = parseFloat(s)
  if (!isFinite(n) || n < 0) return 0
  return Math.min(100, n)
}

// Builds the Deduction[] attached to the saved recurring income, in the
// order they appear in the breakdown so the income detail view can render
// them top-to-bottom without re-sorting.
function buildDeductions(
  breakdown: TaxBreakdown,
  pensionPct: number,
  other: OtherDeduction[],
): Deduction[] {
  const out: Deduction[] = []
  if (breakdown.monthly.pension > 0) {
    out.push({
      name: `Pension (${pensionPct}% sacrifice)`,
      amount: breakdown.monthly.pension,
      type: 'pension',
    })
  }
  other
    .filter((d) => d.preTax && d.monthly > 0)
    .forEach((d) =>
      out.push({
        name: d.name.trim() || 'Pre-tax deduction',
        amount: d.monthly,
        type: 'other',
      }),
    )
  if (breakdown.monthly.incomeTax > 0) {
    out.push({
      name: 'Income Tax',
      amount: breakdown.monthly.incomeTax,
      type: 'tax',
    })
  }
  if (breakdown.monthly.ni > 0) {
    out.push({
      name: 'National Insurance',
      amount: breakdown.monthly.ni,
      type: 'ni',
    })
  }
  other
    .filter((d) => !d.preTax && d.monthly > 0)
    .forEach((d) =>
      out.push({
        name: d.name.trim() || 'Post-tax deduction',
        amount: d.monthly,
        type: 'other',
      }),
    )
  return out
}

export function TaxCalculatorPage() {
  const { dek } = useKeystore()
  const navigate = useNavigate()
  const create = useCreateFlow(dek)

  const [annualGrossInput, setAnnualGrossInput] = useState('')
  const [pensionInput, setPensionInput] = useState('')
  const [other, setOther] = useState<OtherDeduction[]>([])
  const [name, setName] = useState('Salary')
  const [saving, setSaving] = useState(false)

  const annualGrossPence = parseAnnualGross(annualGrossInput)
  const pensionPct = parsePensionPct(pensionInput)

  const breakdown = useMemo<TaxBreakdown>(
    () =>
      calculateTakeHome({
        annualGross: annualGrossPence,
        pensionPct,
        otherDeductions: other,
      }),
    [annualGrossPence, pensionPct, other],
  )

  const hasInput = annualGrossPence > 0

  const addOther = () =>
    setOther((prev) => [
      ...prev,
      { id: newId(), name: '', monthly: 0, preTax: false },
    ])

  const updateOther = (id: string, patch: Partial<OtherDeduction>) =>
    setOther((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...patch } : d)),
    )

  const removeOther = (id: string) =>
    setOther((prev) => prev.filter((d) => d.id !== id))

  const handleSaveAsIncome = async () => {
    if (!dek) {
      toast.error('Locked — please unlock first')
      return
    }
    if (breakdown.monthly.net <= 0) {
      toast.error('Net take-home must be greater than zero')
      return
    }
    setSaving(true)
    const plain: RecurringPlain = {
      kind: 'recurring',
      direction: 'in',
      name: name.trim() || 'Salary',
      amount: breakdown.monthly.gross,
      category: 'salary',
      frequency: { period: 1, unit: 'month' },
      startDate: todayISO(),
      deductions: buildDeductions(breakdown, pensionPct, other),
      taxable: true,
    }
    try {
      await create.mutateAsync(plain)
      toast.success('Saved as recurring income')
      navigate({ to: '/income' })
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to save income',
      )
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen p-4 relative overflow-hidden">
      <PageBackdrop />

      <div className="max-w-5xl mx-auto space-y-6 relative">
        <header className="flex items-center justify-between">
          <Button asChild variant="ghost" size="sm">
            <Link to="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Dashboard
            </Link>
          </Button>
          <ThemeToggle />
        </header>

        <div className="space-y-1">
          <div className="flex items-center gap-2 text-primary">
            <Calculator className="h-6 w-6" />
            <span className="text-xs uppercase tracking-wide font-medium">
              UK tax year {breakdown.cfgLabel} · England, Wales & NI
            </span>
          </div>
          <h1 className="text-3xl font-bold">Salary calculator</h1>
          <p className="text-sm text-muted-foreground">
            Enter your gross salary and pre-tax deductions. We&apos;ll work
            out your tax, NI, and monthly take-home — then you can save it
            straight to your income.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <TaxCalculatorInputs
              annualGrossInput={annualGrossInput}
              setAnnualGrossInput={setAnnualGrossInput}
              pensionInput={pensionInput}
              setPensionInput={setPensionInput}
              other={other}
              onAddOther={addOther}
              onUpdateOther={updateOther}
              onRemoveOther={removeOther}
              monthlyGross={breakdown.monthly.gross}
              monthlyPension={breakdown.monthly.pension}
              pensionPct={pensionPct}
            />
          </div>

          <div className="lg:col-span-3 space-y-4">
            {hasInput ? (
              <TaxCalculatorBreakdown
                breakdown={breakdown}
                pensionPct={pensionPct}
                other={other}
              />
            ) : (
              <Card className="h-full">
                <CardContent className="pt-12 pb-12 text-center space-y-3">
                  <Wallet className="h-10 w-10 mx-auto text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">
                    Enter your gross salary to see the breakdown.
                  </p>
                </CardContent>
              </Card>
            )}

            {hasInput && breakdown.monthly.net > 0 && (
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div className="space-y-1">
                    <Label htmlFor="save-name">
                      Save as recurring income
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Adds a monthly income of{' '}
                      <span className="font-semibold text-foreground tabular-nums">
                        {formatGBP(breakdown.monthly.net)}
                      </span>{' '}
                      starting today, with the breakdown attached.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      id="save-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Salary"
                      className="flex-1"
                    />
                    <Button
                      onClick={handleSaveAsIncome}
                      disabled={saving || !dek}
                      className="sm:w-auto"
                    >
                      {saving && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Save as income
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
