import { PiggyBank, Plus, Receipt, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { formatGBPRounded } from '@/lib/format'
import type { OtherDeduction } from '@/lib/uk-tax'

interface InputsProps {
  annualGrossInput: string
  setAnnualGrossInput: (v: string) => void
  pensionInput: string
  setPensionInput: (v: string) => void
  other: OtherDeduction[]
  onAddOther: () => void
  onUpdateOther: (id: string, patch: Partial<OtherDeduction>) => void
  onRemoveOther: (id: string) => void
  monthlyGross: number
  monthlyPension: number
  pensionPct: number
}

export function TaxCalculatorInputs({
  annualGrossInput,
  setAnnualGrossInput,
  pensionInput,
  setPensionInput,
  other,
  onAddOther,
  onUpdateOther,
  onRemoveOther,
  monthlyGross,
  monthlyPension,
  pensionPct,
}: InputsProps) {
  const hasInput = monthlyGross > 0
  return (
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
              {formatGBPRounded(monthlyGross)}/month before any deductions
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
              {formatGBPRounded(monthlyPension)}/month from your gross before
              tax + NI
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
              onClick={onAddOther}
              className="h-7 px-2 text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add
            </Button>
          </div>
          {other.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">
              Optional — add things like cycle-to-work, share scheme, private
              health, gym…
            </p>
          ) : (
            <div className="space-y-2">
              {other.map((d) => (
                <OtherDeductionRow
                  key={d.id}
                  deduction={d}
                  onChange={(patch) => onUpdateOther(d.id, patch)}
                  onRemove={() => onRemoveOther(d.id)}
                />
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
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
