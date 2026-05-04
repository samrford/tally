import { createFileRoute, Link } from '@tanstack/react-router'
import { useRef, useState } from 'react'
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { ThemeToggle } from '@/components/ThemeToggle'
import { MonthPicker } from '@/components/MonthPicker'
import { RecurringForm, type FormHandle } from '@/components/RecurringForm'
import { OneOffForm } from '@/components/OneOffForm'
import { useKeystore } from '@/lib/keystore'
import { requireUnlocked } from '@/lib/routeGuards'
import {
  useOutgoings,
  useCreateOutgoing,
  useUpdateOutgoing,
  useDeleteOutgoing,
  frequencyLabel,
  type RecurringOutgoing,
  type OneOffOutgoing,
  type OutgoingPlain,
} from '@/lib/outgoings'
import { amountForMonth, isActiveInMonth } from '@/lib/occurrences'

export const Route = createFileRoute('/outgoings')({
  beforeLoad: ({ context }) => requireUnlocked(context),
  component: OutgoingsPage,
})

const gbp = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
})
const formatGBP = (pence: number) => gbp.format(pence / 100)

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

// Rebuilds a OutgoingPlain from a stored recurring item, optionally swapping
// in new overrides.
function recurringToInput(
  item: RecurringOutgoing,
  overrides?: Record<string, number>,
): OutgoingPlain {
  const finalOverrides = overrides ?? item.overrides
  const hasOverrides =
    finalOverrides && Object.keys(finalOverrides).length > 0
  return {
    kind: 'recurring',
    name: item.name,
    amount: item.amount,
    category: item.category,
    frequency: item.frequency,
    startDate: item.startDate,
    ...(item.endDate ? { endDate: item.endDate } : {}),
    ...(item.variable ? { variable: true } : {}),
    ...(hasOverrides ? { overrides: finalOverrides } : {}),
  }
}

type ModalState =
  | { kind: 'create-recurring' }
  | { kind: 'edit-recurring'; id: string }
  | { kind: 'create-one-off' }
  | { kind: 'edit-one-off'; id: string }
  | null

function OutgoingsPage() {
  const { dek } = useKeystore()
  const [selectedMonth, setSelectedMonth] = useState(currentMonth())
  const [modal, setModal] = useState<ModalState>(null)
  const formRef = useRef<FormHandle | null>(null)

  const { data, isLoading } = useOutgoings(dek)
  const create = useCreateOutgoing(dek)
  const update = useUpdateOutgoing(dek)
  const del = useDeleteOutgoing()

  const recurring = (data ?? []).filter(
    (o): o is RecurringOutgoing => o.kind === 'recurring',
  )
  const oneOffs = (data ?? []).filter(
    (o): o is OneOffOutgoing => o.kind === 'one-off',
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
    item: RecurringOutgoing,
    pence: number | null,
  ) => {
    const newOverrides = { ...(item.overrides ?? {}) }
    if (pence === null) delete newOverrides[selectedMonth]
    else newOverrides[selectedMonth] = pence
    await update.mutateAsync({
      id: item.id,
      plain: recurringToInput(item, newOverrides),
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

        <h1 className="text-3xl font-bold">Outgoings</h1>

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
                  if (window.confirm(`Delete recurring outgoing "${r.name}"?`)) {
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
              {modal?.kind === 'create-recurring' && 'Add recurring outgoing'}
              {modal?.kind === 'edit-recurring' && 'Edit recurring outgoing'}
              {modal?.kind === 'create-one-off' && 'Add one-off'}
              {modal?.kind === 'edit-one-off' && 'Edit one-off'}
            </DialogTitle>
          </DialogHeader>

          {modal?.kind === 'create-recurring' && (
            <RecurringForm
              ref={formRef}
              isLoading={create.isPending}
              onCancel={closeModal}
              onSubmit={async (plain) => {
                await create.mutateAsync({ kind: 'recurring', ...plain })
                setModal(null)
              }}
            />
          )}

          {modal?.kind === 'edit-recurring' && editingRecurring && (
            <RecurringForm
              ref={formRef}
              key={editingRecurring.id}
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
                    ...plain,
                    ...(editingRecurring.overrides
                      ? { overrides: editingRecurring.overrides }
                      : {}),
                  },
                })
                setModal(null)
              }}
            />
          )}

          {modal?.kind === 'create-one-off' && (
            <OneOffForm
              ref={formRef}
              defaultDate={firstOfMonth(selectedMonth)}
              isLoading={create.isPending}
              onCancel={closeModal}
              onSubmit={async (plain) => {
                await create.mutateAsync({ kind: 'one-off', ...plain })
                setModal(null)
              }}
            />
          )}

          {modal?.kind === 'edit-one-off' && editingOneOff && (
            <OneOffForm
              ref={formRef}
              key={editingOneOff.id}
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
                  plain: { kind: 'one-off', ...plain },
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
  item: RecurringOutgoing
  ym: string
  onEdit: () => void
  onDelete: () => void
  onSetOverride: (pence: number | null) => Promise<void>
}) {
  const { pence, isEstimate } = amountForMonth(item, ym)

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-md border bg-card">
      <div className="font-medium flex-1 min-w-0 truncate">{item.name}</div>
      <div className="text-xs font-medium uppercase text-primary w-20 shrink-0">
        {item.category}
      </div>
      <div className="text-xs text-muted-foreground w-32 shrink-0">
        {frequencyLabel(item.frequency)}
      </div>
      <div className="w-28 shrink-0 text-right">
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
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="About this estimate"
                    className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center size-4 rounded-full bg-primary text-primary-foreground text-[9px] font-semibold leading-none cursor-help shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    i
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  Estimate from baseline — enter actual value for the month.
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        ) : (
          <span className="font-medium tabular-nums">{formatGBP(pence)}</span>
        )}
      </div>
      <div className="flex gap-1 shrink-0">
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
  item: OneOffOutgoing
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-md border bg-card">
      <div className="font-medium flex-1 min-w-0 truncate">{item.name}</div>
      <div className="text-xs font-medium uppercase text-primary w-20 shrink-0">
        {item.category}
      </div>
      <div className="text-xs text-muted-foreground w-32 shrink-0 tabular-nums">
        {format(parseLocalISO(item.date), 'd MMM yyyy')}
      </div>
      <div className="font-medium tabular-nums w-28 shrink-0 text-right">
        {formatGBP(item.amount)}
      </div>
      <div className="flex gap-1 shrink-0">
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
  )
}
