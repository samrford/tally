import {
  useImperativeHandle,
  useMemo,
  useState,
  type FormEvent,
  type Ref,
} from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DialogFooter } from '@/components/ui/dialog'
import { DatePicker } from '@/components/DatePicker'
import {
  CATEGORIES,
  type Category,
  type FrequencyUnit,
  type RecurringPlain,
} from '@/lib/outgoings'

export type RecurringFormValues = Omit<
  RecurringPlain,
  'kind' | 'overrides'
>

export interface FormHandle {
  isDirty: () => boolean
}

interface Props {
  ref?: Ref<FormHandle>
  initial?: RecurringFormValues
  onSubmit: (plain: RecurringFormValues) => Promise<void>
  onCancel: () => void
  submitLabel?: string
  isLoading?: boolean
}

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

export function RecurringForm({
  ref,
  initial,
  onSubmit,
  onCancel,
  submitLabel = 'Add',
  isLoading,
}: Props) {
  // Capture initial values once so dirty checks have a stable baseline.
  const baseline = useMemo(
    () => ({
      name: initial?.name ?? '',
      amount: initial ? (initial.amount / 100).toFixed(2) : '',
      category: (initial?.category ?? 'bills') as Category,
      period: String(initial?.frequency.period ?? 1),
      unit: (initial?.frequency.unit ?? 'month') as FrequencyUnit,
      startDate: initial?.startDate ?? todayISO(),
      endDate: initial?.endDate ?? '',
      variable: initial?.variable ?? false,
    }),
    [initial],
  )

  const [name, setName] = useState(baseline.name)
  const [amount, setAmount] = useState(baseline.amount)
  const [category, setCategory] = useState<Category>(baseline.category)
  const [period, setPeriod] = useState(baseline.period)
  const [unit, setUnit] = useState<FrequencyUnit>(baseline.unit)
  const [startDate, setStartDate] = useState(baseline.startDate)
  const [endDate, setEndDate] = useState(baseline.endDate)
  const [variable, setVariable] = useState(baseline.variable)

  const isDirty =
    name !== baseline.name ||
    amount !== baseline.amount ||
    category !== baseline.category ||
    period !== baseline.period ||
    unit !== baseline.unit ||
    startDate !== baseline.startDate ||
    endDate !== baseline.endDate ||
    variable !== baseline.variable

  useImperativeHandle(ref, () => ({ isDirty: () => isDirty }), [isDirty])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const periodN = Math.max(1, Math.floor(parseInt(period, 10) || 1))
    const pence = Math.round(parseFloat(amount) * 100)
    const data: RecurringFormValues = {
      name: name.trim(),
      amount: pence,
      category,
      frequency: { period: periodN, unit },
      startDate,
      ...(endDate ? { endDate } : {}),
      ...(variable ? { variable: true } : {}),
    }
    await onSubmit(data)
  }

  const startDateObj = (() => {
    if (!startDate) return null
    const [y, m, d] = startDate.split('-').map(Number)
    return new Date(y, m - 1, d)
  })()

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="rec-name">Name</Label>
        <Input
          id="rec-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Netflix, Council tax…"
          autoFocus
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="rec-amount">
            {variable ? 'Baseline estimate (£)' : 'Amount (£)'}
          </Label>
          <Input
            id="rec-amount"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="rec-category">Category</Label>
          <Select
            value={category}
            onValueChange={(v) => setCategory(v as Category)}
          >
            <SelectTrigger id="rec-category" className="capitalize">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c} className="capitalize">
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1">
        <Label>Repeats every</Label>
        <div className="flex gap-2">
          <Input
            type="number"
            min="1"
            step="1"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="w-24"
            aria-label="Period"
            required
          />
          <Select
            value={unit}
            onValueChange={(v) => setUnit(v as FrequencyUnit)}
          >
            <SelectTrigger aria-label="Unit" className="flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Weeks</SelectItem>
              <SelectItem value="month">Months</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="rec-start">Start date</Label>
          <DatePicker
            id="rec-start"
            value={startDate}
            onChange={setStartDate}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="rec-end">End date (optional)</Label>
          <DatePicker
            id="rec-end"
            value={endDate}
            onChange={setEndDate}
            optional
            placeholder="No end"
            disabled={
              startDateObj
                ? (date) => date < startDateObj
                : undefined
            }
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          id="rec-variable"
          type="checkbox"
          checked={variable}
          onChange={(e) => setVariable(e.target.checked)}
          className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
        />
        <Label htmlFor="rec-variable" className="cursor-pointer text-sm">
          Variable amount (set per month)
        </Label>
      </div>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {submitLabel}
        </Button>
      </DialogFooter>
    </form>
  )
}
