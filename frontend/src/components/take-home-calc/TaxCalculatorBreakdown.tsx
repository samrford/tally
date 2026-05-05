import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { formatGBP, formatGBPRounded } from '@/lib/format'
import type { OtherDeduction, TaxBreakdown } from '@/lib/uk-tax'

const formatPct = (n: number) =>
  `${(n * 100).toFixed(1).replace(/\.0$/, '')}%`

interface BreakdownProps {
  breakdown: TaxBreakdown
  pensionPct: number
  other: OtherDeduction[]
}

export function TaxCalculatorBreakdown({
  breakdown,
  pensionPct,
  other,
}: BreakdownProps) {
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
              {formatGBP(b.monthly.net)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {formatGBP(b.netAnnual)} per year
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
          {formatGBP(monthly)}
        </div>
        <div className="text-xs text-muted-foreground tabular-nums">
          {formatGBPRounded(annual)}/yr
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
          −{formatGBP(monthly)}
        </div>
        <div className="text-[11px] text-muted-foreground tabular-nums">
          {formatGBPRounded(annual)}/yr · {formatPct(pct)}
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
            title={`${s.label}: ${formatGBP(s.pence)}`}
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
