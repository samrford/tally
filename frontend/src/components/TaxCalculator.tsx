import { useMemo, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import toast from 'react-hot-toast'
import {
  ArrowLeft,
  Calculator,
  Loader2,
  PiggyBank,
  Plus,
  Receipt,
  Trash2,
  Wallet,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ThemeToggle } from '@/components/ThemeToggle'
import { cn } from '@/lib/utils'
import { useKeystore } from '@/lib/keystore'
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

const gbp = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  maximumFractionDigits: 0,
})
const gbp2 = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
})
const formatGBP = (pence: number) => gbp.format(pence / 100)
const formatGBP2 = (pence: number) => gbp2.format(pence / 100)
const formatPct = (n: number) =>
  `${(n * 100).toFixed(1).replace(/\.0$/, '')}%`

const todayISO = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

let nextId = 0
const newId = () => `d${++nextId}`

export function TaxCalculatorPage() {
  const { dek } = useKeystore()
  const navigate = useNavigate()
  const create = useCreateFlow(dek)

  const [annualGrossInput, setAnnualGrossInput] = useState('')
  const [pensionInput, setPensionInput] = useState('')
  const [other, setOther] = useState<OtherDeduction[]>([])
  const [name, setName] = useState('Salary')
  const [saving, setSaving] = useState(false)

  const annualGrossPence = (() => {
    const n = parseFloat(annualGrossInput)
    if (!isFinite(n) || n < 0) return 0
    return Math.round(n * 100)
  })()
  const pensionPct = (() => {
    const n = parseFloat(pensionInput)
    if (!isFinite(n) || n < 0) return 0
    return Math.min(100, n)
  })()

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
    const deductions: Deduction[] = []
    if (breakdown.monthly.pension > 0) {
      deductions.push({
        name: `Pension (${pensionPct}% sacrifice)`,
        amount: breakdown.monthly.pension,
        type: 'pension',
      })
    }
    other
      .filter((d) => d.preTax && d.monthly > 0)
      .forEach((d) =>
        deductions.push({
          name: d.name.trim() || 'Pre-tax deduction',
          amount: d.monthly,
          type: 'other',
        }),
      )
    if (breakdown.monthly.incomeTax > 0) {
      deductions.push({
        name: 'Income Tax',
        amount: breakdown.monthly.incomeTax,
        type: 'tax',
      })
    }
    if (breakdown.monthly.ni > 0) {
      deductions.push({
        name: 'National Insurance',
        amount: breakdown.monthly.ni,
        type: 'ni',
      })
    }
    other
      .filter((d) => !d.preTax && d.monthly > 0)
      .forEach((d) =>
        deductions.push({
          name: d.name.trim() || 'Post-tax deduction',
          amount: d.monthly,
          type: 'other',
        }),
      )

    const plain: RecurringPlain = {
      kind: 'recurring',
      direction: 'in',
      name: name.trim() || 'Salary',
      amount: breakdown.monthly.gross,
      category: 'salary',
      frequency: { period: 1, unit: 'month' },
      startDate: todayISO(),
      deductions,
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
      <div className="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[150px] pointer-events-none" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-accent/20 rounded-full blur-[150px] pointer-events-none" />

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
            <Card>
              <CardContent className="pt-6 space-y-5">
                <div className="space-y-1">
                  <Label htmlFor="gross">Annual gross salary</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                      £
                    </span>
                    <Input
                      id="gross"
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      value={annualGrossInput}
                      onChange={(e) => setAnnualGrossInput(e.target.value)}
                      placeholder="45,000"
                      className="pl-7 text-lg font-semibold tabular-nums"
                      autoFocus
                    />
                  </div>
                  {hasInput && (
                    <p className="text-xs text-muted-foreground pt-0.5">
                      {formatGBP(breakdown.monthly.gross)}/month before any
                      deductions
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="pension" className="flex items-center gap-1.5">
                    <PiggyBank className="h-3.5 w-3.5 text-primary" />
                    Pension salary sacrifice
                  </Label>
                  <div className="relative">
                    <Input
                      id="pension"
                      type="number"
                      inputMode="decimal"
                      step="0.5"
                      min="0"
                      max="100"
                      value={pensionInput}
                      onChange={(e) => setPensionInput(e.target.value)}
                      placeholder="5"
                      className="pr-8 tabular-nums"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                      %
                    </span>
                  </div>
                  {pensionPct > 0 && hasInput && (
                    <p className="text-xs text-muted-foreground pt-0.5">
                      {formatGBP(breakdown.monthly.pension)}/month from your
                      gross before tax + NI
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-1.5">
                      <Receipt className="h-3.5 w-3.5 text-primary" />
                      Other deductions
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={addOther}
                      className="h-7 px-2 text-xs"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add
                    </Button>
                  </div>
                  {other.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">
                      Optional — add things like cycle-to-work, share scheme,
                      private health, gym…
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {other.map((d) => (
                        <OtherDeductionRow
                          key={d.id}
                          deduction={d}
                          onChange={(patch) => updateOther(d.id, patch)}
                          onRemove={() => removeOther(d.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-3 space-y-4">
            {hasInput ? (
              <BreakdownCard
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
                    <Label htmlFor="save-name">Save as recurring income</Label>
                    <p className="text-xs text-muted-foreground">
                      Adds a monthly income of{' '}
                      <span className="font-semibold text-foreground tabular-nums">
                        {formatGBP2(breakdown.monthly.net)}
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

function OtherDeductionRow({
  deduction,
  onChange,
  onRemove,
}: {
  deduction: OtherDeduction
  onChange: (patch: Partial<OtherDeduction>) => void
  onRemove: () => void
}) {
  const monthlyInput =
    deduction.monthly === 0 ? '' : (deduction.monthly / 100).toFixed(2)
  return (
    <div className="rounded-lg border bg-background/50 p-3 space-y-2">
      <div className="flex gap-2">
        <Input
          value={deduction.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Cycle to work"
          className="flex-1 h-9"
        />
        <div className="relative w-28">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
            £
          </span>
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={monthlyInput}
            onChange={(e) => {
              const n = parseFloat(e.target.value)
              onChange({
                monthly: isFinite(n) && n > 0 ? Math.round(n * 100) : 0,
              })
            }}
            placeholder="0.00"
            className="pl-6 h-9 tabular-nums"
            aria-label="Monthly amount"
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          className="h-9 w-9 text-muted-foreground hover:text-destructive shrink-0"
          aria-label="Remove deduction"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex items-center gap-1 text-xs">
        <button
          type="button"
          onClick={() => onChange({ preTax: true })}
          className={cn(
            'flex-1 px-2 py-1 rounded-md border transition-colors',
            deduction.preTax
              ? 'border-primary bg-primary/10 text-primary font-medium'
              : 'border-transparent text-muted-foreground hover:bg-muted',
          )}
        >
          Pre-tax (salary sacrifice)
        </button>
        <button
          type="button"
          onClick={() => onChange({ preTax: false })}
          className={cn(
            'flex-1 px-2 py-1 rounded-md border transition-colors',
            !deduction.preTax
              ? 'border-primary bg-primary/10 text-primary font-medium'
              : 'border-transparent text-muted-foreground hover:bg-muted',
          )}
        >
          Post-tax
        </button>
      </div>
    </div>
  )
}

function BreakdownCard({
  breakdown,
  pensionPct,
  other,
}: {
  breakdown: TaxBreakdown
  pensionPct: number
  other: OtherDeduction[]
}) {
  const b = breakdown
  const preTaxOther = other.filter((d) => d.preTax && d.monthly > 0)
  const postTaxOther = other.filter((d) => !d.preTax && d.monthly > 0)

  const totalDeductionsMonthly =
    b.monthly.pension +
    b.monthly.otherPreTax +
    b.monthly.incomeTax +
    b.monthly.ni +
    b.monthly.otherPostTax

  return (
    <Card className="overflow-hidden">
      <CardContent className="pt-6 space-y-5">
        <div className="flex items-end justify-between gap-4 pb-4 border-b">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Monthly take-home
            </div>
            <div className="text-4xl sm:text-5xl font-bold tabular-nums text-primary">
              {formatGBP2(b.monthly.net)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {formatGBP2(b.netAnnual)} per year
            </div>
          </div>
          <div className="text-right text-xs space-y-0.5">
            <div className="text-muted-foreground uppercase tracking-wide">
              Effective tax + NI
            </div>
            <div className="text-2xl font-semibold tabular-nums">
              {formatPct(b.effectiveRate)}
            </div>
            <div className="text-muted-foreground">of gross</div>
          </div>
        </div>

        <div className="space-y-1">
          <SummaryRow
            label="Gross salary"
            sublabel={pensionPct > 0 ? 'Before any deductions' : undefined}
            monthly={b.monthly.gross}
            annual={b.annualGross}
            tone="gross"
          />

          {b.monthly.pension > 0 && (
            <DeductionRow
              label="Pension"
              sublabel={`${pensionPct}% salary sacrifice`}
              monthly={b.monthly.pension}
              annual={b.pensionAnnual}
              percentOf={b.annualGross}
              accent="pension"
            />
          )}

          {preTaxOther.map((d) => (
            <DeductionRow
              key={d.id}
              label={d.name.trim() || 'Pre-tax deduction'}
              sublabel="Salary sacrifice"
              monthly={d.monthly}
              annual={d.monthly * 12}
              percentOf={b.annualGross}
              accent="pretax"
            />
          ))}

          {b.monthly.pension > 0 || preTaxOther.length > 0 ? (
            <SummaryRow
              label="Taxable pay"
              monthly={b.monthly.taxableGross}
              annual={b.taxableGross}
              tone="subtotal"
            />
          ) : null}

          {b.monthly.incomeTax > 0 && (
            <DeductionRow
              label="Income tax"
              sublabel={`UK ${b.cfgLabel}`}
              monthly={b.monthly.incomeTax}
              annual={b.incomeTaxAnnual}
              percentOf={b.annualGross}
              accent="tax"
            />
          )}

          {b.monthly.ni > 0 && (
            <DeductionRow
              label="National Insurance"
              sublabel="Class 1 employee"
              monthly={b.monthly.ni}
              annual={b.niAnnual}
              percentOf={b.annualGross}
              accent="tax"
            />
          )}

          {postTaxOther.map((d) => (
            <DeductionRow
              key={d.id}
              label={d.name.trim() || 'Post-tax deduction'}
              sublabel="From take-home"
              monthly={d.monthly}
              annual={d.monthly * 12}
              percentOf={b.annualGross}
              accent="other"
            />
          ))}

          <SummaryRow
            label="Take-home pay"
            monthly={b.monthly.net}
            annual={b.netAnnual}
            tone="net"
          />
        </div>

        {totalDeductionsMonthly > 0 && b.annualGross > 0 && (
          <DeductionsBar
            gross={b.monthly.gross}
            segments={[
              {
                label: 'Pension',
                pence: b.monthly.pension,
                color: 'bg-primary/40',
              },
              {
                label: 'Other pre-tax',
                pence: b.monthly.otherPreTax,
                color: 'bg-primary/30',
              },
              {
                label: 'Income tax',
                pence: b.monthly.incomeTax,
                color: 'bg-primary/80',
              },
              {
                label: 'NI',
                pence: b.monthly.ni,
                color: 'bg-primary/60',
              },
              {
                label: 'Other post-tax',
                pence: b.monthly.otherPostTax,
                color: 'bg-accent',
              },
              {
                label: 'Take-home',
                pence: b.monthly.net,
                color: 'bg-foreground/80',
              },
            ]}
          />
        )}
      </CardContent>
    </Card>
  )
}

function SummaryRow({
  label,
  sublabel,
  monthly,
  annual,
  tone,
}: {
  label: string
  sublabel?: string
  monthly: number
  annual: number
  tone: 'gross' | 'subtotal' | 'net'
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 py-2.5 px-3 rounded-md',
        tone === 'gross' && 'bg-muted/50',
        tone === 'subtotal' && 'bg-muted/40 border border-border/60',
        tone === 'net' && 'bg-primary/10 border border-primary/30 mt-2',
      )}
    >
      <div>
        <div
          className={cn(
            'font-semibold',
            tone === 'net' && 'text-primary text-base',
          )}
        >
          {label}
        </div>
        {sublabel && (
          <div className="text-xs text-muted-foreground">{sublabel}</div>
        )}
      </div>
      <div className="text-right">
        <div
          className={cn(
            'font-bold tabular-nums',
            tone === 'net' ? 'text-primary text-lg' : 'text-base',
          )}
        >
          {formatGBP2(monthly)}
        </div>
        <div className="text-xs text-muted-foreground tabular-nums">
          {formatGBP(annual)}/yr
        </div>
      </div>
    </div>
  )
}

function DeductionRow({
  label,
  sublabel,
  monthly,
  annual,
  percentOf,
  accent,
}: {
  label: string
  sublabel?: string
  monthly: number
  annual: number
  percentOf: number
  accent: 'tax' | 'pension' | 'pretax' | 'other'
}) {
  const dotColor =
    accent === 'tax'
      ? 'bg-primary/80'
      : accent === 'pension'
        ? 'bg-primary/40'
        : accent === 'pretax'
          ? 'bg-primary/30'
          : 'bg-accent'
  const pct = percentOf > 0 ? annual / percentOf : 0
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 px-3">
      <div className="flex items-center gap-2 min-w-0">
        <span className={cn('h-2 w-2 rounded-full shrink-0', dotColor)} />
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">{label}</div>
          {sublabel && (
            <div className="text-xs text-muted-foreground truncate">
              {sublabel}
            </div>
          )}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-sm font-semibold tabular-nums text-muted-foreground">
          −{formatGBP2(monthly)}
        </div>
        <div className="text-[11px] text-muted-foreground tabular-nums">
          {formatGBP(annual)}/yr · {formatPct(pct)}
        </div>
      </div>
    </div>
  )
}

function DeductionsBar({
  gross,
  segments,
}: {
  gross: number
  segments: { label: string; pence: number; color: string }[]
}) {
  if (gross <= 0) return null
  const filtered = segments.filter((s) => s.pence > 0)
  return (
    <div className="space-y-2 pt-2">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        Where each £1 goes
      </div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
        {filtered.map((s) => (
          <div
            key={s.label}
            className={cn('h-full', s.color)}
            style={{ width: `${(s.pence / gross) * 100}%` }}
            title={`${s.label}: ${formatGBP2(s.pence)}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {filtered.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5">
            <span className={cn('h-2 w-2 rounded-full', s.color)} />
            <span>{s.label}</span>
            <span className="tabular-nums">
              {formatPct(s.pence / gross)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
