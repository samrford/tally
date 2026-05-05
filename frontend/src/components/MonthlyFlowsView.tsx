import { lazy, Suspense, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { format } from 'date-fns'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { ThemeToggle } from '@/components/ThemeToggle'
import { MonthPicker } from '@/components/MonthPicker'
// Lazy-loaded so recharts (~140KB gzipped) doesn't block the route's first
// paint — the chart only renders when there's data to show, which is a
// natural place to spend the network round-trip.
const CategoryPieChart = lazy(() =>
  import('@/components/CategoryPieChart').then((m) => ({
    default: m.CategoryPieChart,
  })),
)
import { RecurringForm, type FormHandle } from '@/components/RecurringForm'
import { OneOffForm } from '@/components/OneOffForm'
import { useKeystore } from '@/lib/keystore'
import {
  useFlows,
  useCreateFlow,
  useUpdateFlow,
  useDeleteFlow,
  frequencyLabel,
  type Category,
  type FlowDirection,
  type FlowPlain,
  type RecurringFlow,
  type OneOffFlow,
} from '@/lib/flows'
import { amountForMonth, isActiveInMonth } from '@/lib/occurrences'
import { formatGBP } from '@/lib/format'

function currentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number)
  const target = new Date(Date.UTC(y, m - 1 + delta, 1))
  return `${target.getUTCFullYear()}-${String(
    target.getUTCMonth() + 1,
  ).padStart(2, '0')}`
}

function prettyMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function firstOfMonth(ym: string): string {
  return `${ym}-01`
}

function parseLocalISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// Rebuilds a RecurringPlain from a stored recurring flow, optionally swapping
// in new overrides. Direction + deductions + taxable carry over from the item.
function recurringToPlain(
  item: RecurringFlow,
  overrides?: Record<string, number>,
): FlowPlain {
  const finalOverrides = overrides ?? item.overrides
  const hasOverrides =
    finalOverrides && Object.keys(finalOverrides).length > 0
  return {
    kind: 'recurring',
    direction: item.direction,
    name: item.name,
    amount: item.amount,
    category: item.category,
    frequency: item.frequency,
    startDate: item.startDate,
    ...(item.endDate ? { endDate: item.endDate } : {}),
    ...(item.variable ? { variable: true } : {}),
    ...(hasOverrides ? { overrides: finalOverrides } : {}),
    ...(item.deductions ? { deductions: item.deductions } : {}),
    ...(item.taxable ? { taxable: true } : {}),
  }
}

type ModalState =
  | { kind: 'create-recurring' }
  | { kind: 'edit-recurring'; id: string }
  | { kind: 'create-one-off' }
  | { kind: 'edit-one-off'; id: string }
  | null

interface Props {
  direction: FlowDirection
  title: string
  categories: readonly Category[]
}

export function MonthlyFlowsView({ direction, title, categories }: Props) {
  const noun = direction === 'in' ? 'income' : 'outgoing'

  const { dek } = useKeystore()
  const [selectedMonth, setSelectedMonth] = useState(currentMonth())
  const [modal, setModal] = useState<ModalState>(null)
  const formRef = useRef<FormHandle | null>(null)

  const { data, isLoading } = useFlows(dek)
  const create = useCreateFlow(dek)
  const update = useUpdateFlow(dek)
  const del = useDeleteFlow()

  const ofDirection = (data ?? []).filter((f) => f.direction === direction)

  const recurring = ofDirection.filter(
    (o): o is RecurringFlow => o.kind === 'recurring',
  )
  const oneOffs = ofDirection.filter(
    (o): o is OneOffFlow => o.kind === 'one-off',
  )

  const activeRecurring = recurring
    .filter((r) => isActiveInMonth(r, selectedMonth))
    .sort((a, b) => a.name.localeCompare(b.name))

  const monthOneOffs = oneOffs
    .filter((o) => o.date.startsWith(selectedMonth))
    .sort((a, b) => a.date.localeCompare(b.date))

  const recurringTotal = activeRecurring.reduce(
    (sum, r) => sum + amountForMonth(r, selectedMonth).pence,
    0,
  )
  const oneOffTotal = monthOneOffs.reduce((sum, o) => sum + o.amount, 0)
  const monthlyTotal = recurringTotal + oneOffTotal

  // Per-category totals for the chart.
  const categoryTotals = new Map<Category, number>()
  const addCategory = (cat: Category, pence: number) => {
    categoryTotals.set(cat, (categoryTotals.get(cat) ?? 0) + pence)
  }
  activeRecurring.forEach((r) =>
    addCategory(r.category, amountForMonth(r, selectedMonth).pence),
  )
  monthOneOffs.forEach((o) => addCategory(o.category, o.amount))
  const categoryData = Array.from(categoryTotals.entries()).map(
    ([category, pence]) => ({ category, pence }),
  )

  const editingRecurring =
    modal?.kind === 'edit-recurring'
      ? recurring.find((r) => r.id === modal.id)
      : undefined
  const editingOneOff =
    modal?.kind === 'edit-one-off'
      ? oneOffs.find((o) => o.id === modal.id)
      : undefined

  const closeModal = () => {
    if (formRef.current?.isDirty?.()) {
      if (!window.confirm('You have unsaved changes. Discard them?')) return
    }
    setModal(null)
  }

  const handleSetOverride = async (
    item: RecurringFlow,
    pence: number | null,
  ) => {
    const newOverrides = { ...(item.overrides ?? {}) }
    if (pence === null) delete newOverrides[selectedMonth]
    else newOverrides[selectedMonth] = pence
    await update.mutateAsync({
      id: item.id,
      plain: recurringToPlain(item, newOverrides),
    })
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <Button asChild variant="ghost" size="sm">
            <Link to="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Dashboard
            </Link>
          </Button>
          <ThemeToggle />
        </header>

        <h1 className="text-3xl font-bold">{title}</h1>

        <Card>
          <CardContent className="pt-6 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setSelectedMonth(shiftMonth(selectedMonth, -1))}
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <MonthPicker
                value={selectedMonth}
                onChange={setSelectedMonth}
                className="w-44"
                ariaLabel="Select month"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => setSelectedMonth(shiftMonth(selectedMonth, 1))}
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              {selectedMonth !== currentMonth() && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedMonth(currentMonth())}
                >
                  Today
                </Button>
              )}
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground uppercase tracking-wide">
                {prettyMonth(selectedMonth)} total
              </div>
              <div className="text-2xl font-bold tabular-nums">
                {formatGBP(monthlyTotal)}
              </div>
            </div>
          </CardContent>
        </Card>

        {monthlyTotal > 0 && (
          <Card>
            <CardContent className="pt-6">
              <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-4">
                By category
              </h2>
              <Suspense fallback={<div className="h-56" />}>
                <CategoryPieChart
                  data={categoryData}
                  total={monthlyTotal}
                  categories={categories}
                />
              </Suspense>
            </CardContent>
          </Card>
        )}

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-xl font-semibold">Recurring</h2>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setModal({ kind: 'create-recurring' })}
              >
                <Plus className="mr-1 h-4 w-4" />
                Add recurring
              </Button>
              <span className="text-sm text-muted-foreground tabular-nums w-24 text-right">
                {formatGBP(recurringTotal)}
              </span>
            </div>
          </div>
          <div className="space-y-2">
            {!isLoading && activeRecurring.length === 0 && (
              <p className="text-muted-foreground text-center py-6 text-sm">
                Nothing recurring this month.
              </p>
            )}
            {activeRecurring.map((r) => (
              <RecurringRow
                key={r.id}
                item={r}
                ym={selectedMonth}
                onEdit={() => setModal({ kind: 'edit-recurring', id: r.id })}
                onDelete={() => {
                  if (window.confirm(`Delete recurring ${noun} "${r.name}"?`)) {
                    del.mutate(r.id)
                  }
                }}
                onSetOverride={(pence) => handleSetOverride(r, pence)}
              />
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-xl font-semibold">
              One-offs ({prettyMonth(selectedMonth)})
            </h2>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setModal({ kind: 'create-one-off' })}
              >
                <Plus className="mr-1 h-4 w-4" />
                Add one-off
              </Button>
              <span className="text-sm text-muted-foreground tabular-nums w-24 text-right">
                {formatGBP(oneOffTotal)}
              </span>
            </div>
          </div>
          <div className="space-y-2">
            {isLoading && (
              <p className="text-muted-foreground text-sm">Loading…</p>
            )}
            {!isLoading && monthOneOffs.length === 0 && (
              <p className="text-muted-foreground text-center py-6 text-sm">
                No one-offs in {prettyMonth(selectedMonth)}.
              </p>
            )}
            {monthOneOffs.map((o) => (
              <OneOffRow
                key={o.id}
                item={o}
                onEdit={() => setModal({ kind: 'edit-one-off', id: o.id })}
                onDelete={() => {
                  if (window.confirm(`Delete "${o.name}"?`)) del.mutate(o.id)
                }}
              />
            ))}
          </div>
        </section>
      </div>

      <Dialog
        open={modal !== null}
        onOpenChange={(open) => {
          if (!open) closeModal()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {modal?.kind === 'create-recurring' && `Add recurring ${noun}`}
              {modal?.kind === 'edit-recurring' && `Edit recurring ${noun}`}
              {modal?.kind === 'create-one-off' && `Add one-off ${noun}`}
              {modal?.kind === 'edit-one-off' && `Edit one-off ${noun}`}
            </DialogTitle>
          </DialogHeader>

          {modal?.kind === 'create-recurring' && (
            <RecurringForm
              ref={formRef}
              categories={categories}
              isLoading={create.isPending}
              onCancel={closeModal}
              onSubmit={async (plain) => {
                await create.mutateAsync({
                  kind: 'recurring',
                  direction,
                  ...plain,
                })
                setModal(null)
              }}
            />
          )}

          {modal?.kind === 'edit-recurring' && editingRecurring && (
            <RecurringForm
              ref={formRef}
              key={editingRecurring.id}
              categories={categories}
              initial={{
                name: editingRecurring.name,
                amount: editingRecurring.amount,
                category: editingRecurring.category,
                frequency: editingRecurring.frequency,
                startDate: editingRecurring.startDate,
                endDate: editingRecurring.endDate,
                variable: editingRecurring.variable,
              }}
              submitLabel="Save"
              isLoading={update.isPending}
              onCancel={closeModal}
              onSubmit={async (plain) => {
                await update.mutateAsync({
                  id: editingRecurring.id,
                  plain: {
                    kind: 'recurring',
                    direction: editingRecurring.direction,
                    ...plain,
                    ...(editingRecurring.overrides
                      ? { overrides: editingRecurring.overrides }
                      : {}),
                    ...(editingRecurring.deductions
                      ? { deductions: editingRecurring.deductions }
                      : {}),
                    ...(editingRecurring.taxable ? { taxable: true } : {}),
                  },
                })
                setModal(null)
              }}
            />
          )}

          {modal?.kind === 'create-one-off' && (
            <OneOffForm
              ref={formRef}
              categories={categories}
              defaultDate={firstOfMonth(selectedMonth)}
              isLoading={create.isPending}
              onCancel={closeModal}
              onSubmit={async (plain) => {
                await create.mutateAsync({
                  kind: 'one-off',
                  direction,
                  ...plain,
                })
                setModal(null)
              }}
            />
          )}

          {modal?.kind === 'edit-one-off' && editingOneOff && (
            <OneOffForm
              ref={formRef}
              key={editingOneOff.id}
              categories={categories}
              initial={{
                name: editingOneOff.name,
                amount: editingOneOff.amount,
                category: editingOneOff.category,
                date: editingOneOff.date,
              }}
              submitLabel="Save"
              isLoading={update.isPending}
              onCancel={closeModal}
              onSubmit={async (plain) => {
                await update.mutateAsync({
                  id: editingOneOff.id,
                  plain: {
                    kind: 'one-off',
                    direction: editingOneOff.direction,
                    ...plain,
                    ...(editingOneOff.deductions
                      ? { deductions: editingOneOff.deductions }
                      : {}),
                    ...(editingOneOff.taxable ? { taxable: true } : {}),
                  },
                })
                setModal(null)
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function RecurringRow({
  item,
  ym,
  onEdit,
  onDelete,
  onSetOverride,
}: {
  item: RecurringFlow
  ym: string
  onEdit: () => void
  onDelete: () => void
  onSetOverride: (pence: number | null) => Promise<void>
}) {
  const { pence, isEstimate } = amountForMonth(item, ym)

  return (
    <div className="rounded-md border bg-card px-3 sm:px-4 py-3">
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{item.name}</div>
          <div className="mt-0.5 flex items-center gap-2 text-xs sm:hidden">
            <span className="font-medium uppercase text-primary">
              {item.category}
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">
              {frequencyLabel(item.frequency)}
            </span>
          </div>
        </div>
        <div className="hidden sm:block text-xs font-medium uppercase text-primary w-20 shrink-0">
          {item.category}
        </div>
        <div className="hidden sm:block text-xs text-muted-foreground w-32 shrink-0">
          {frequencyLabel(item.frequency)}
        </div>
        <div className="w-24 sm:w-28 shrink-0 text-right">
          {item.variable ? (
            <div className="relative">
              <VariableAmountInput
                key={ym}
                override={item.overrides?.[ym]}
                estimate={pence}
                isEstimate={isEstimate}
                onCommit={onSetOverride}
              />
              {isEstimate && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      aria-label="About this estimate"
                      className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center size-4 rounded-full bg-primary text-primary-foreground text-[9px] font-semibold leading-none shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      i
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    side="top"
                    align="end"
                    className="w-auto max-w-xs p-3 text-xs"
                  >
                    Estimate from baseline — enter actual value for the month.
                  </PopoverContent>
                </Popover>
              )}
            </div>
          ) : (
            <span className="font-medium tabular-nums">{formatGBP(pence)}</span>
          )}
        </div>
        <div className="flex gap-0.5 sm:gap-1 shrink-0">
          <Button variant="ghost" size="icon" onClick={onEdit} aria-label="Edit">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            aria-label="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

function VariableAmountInput({
  override,
  estimate,
  isEstimate,
  onCommit,
}: {
  override: number | undefined
  estimate: number
  isEstimate: boolean
  onCommit: (pence: number | null) => Promise<void>
}) {
  // Caller passes `key={ym}` so this resets cleanly when the user navigates
  // to a different month.
  const [value, setValue] = useState(
    override !== undefined ? (override / 100).toFixed(2) : '',
  )

  const handleBlur = async () => {
    const trimmed = value.trim()
    if (trimmed === '') {
      if (override !== undefined) await onCommit(null)
      return
    }
    const parsed = parseFloat(trimmed)
    if (Number.isNaN(parsed) || parsed < 0) {
      setValue(override !== undefined ? (override / 100).toFixed(2) : '')
      return
    }
    const pence = Math.round(parsed * 100)
    if (pence !== override) await onCommit(pence)
  }

  return (
    <Input
      type="number"
      inputMode="decimal"
      step="0.01"
      min="0"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
      }}
      placeholder={(estimate / 100).toFixed(2)}
      className={cn(
        'text-right tabular-nums w-full h-8 px-2',
        isEstimate &&
          'border-primary/60 border-dashed placeholder:text-primary/60',
      )}
    />
  )
}

function OneOffRow({
  item,
  onEdit,
  onDelete,
}: {
  item: OneOffFlow
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="rounded-md border bg-card px-3 sm:px-4 py-3">
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{item.name}</div>
          <div className="mt-0.5 flex items-center gap-2 text-xs sm:hidden">
            <span className="font-medium uppercase text-primary">
              {item.category}
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground tabular-nums">
              {format(parseLocalISO(item.date), 'd MMM yyyy')}
            </span>
          </div>
        </div>
        <div className="hidden sm:block text-xs font-medium uppercase text-primary w-20 shrink-0">
          {item.category}
        </div>
        <div className="hidden sm:block text-xs text-muted-foreground w-32 shrink-0 tabular-nums">
          {format(parseLocalISO(item.date), 'd MMM yyyy')}
        </div>
        <div className="font-medium tabular-nums w-24 sm:w-28 shrink-0 text-right">
          {formatGBP(item.amount)}
        </div>
        <div className="flex gap-0.5 sm:gap-1 shrink-0">
          <Button variant="ghost" size="icon" onClick={onEdit} aria-label="Edit">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            aria-label="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
