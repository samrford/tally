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
import { type Category } from '@/lib/flows'
import type { FormHandle } from '@/components/RecurringForm'

export interface OneOffFormValues {
  name: string
  amount: number // pence
  category: Category
  date: string
}

interface Props {
  ref?: Ref<FormHandle>
  initial?: OneOffFormValues
  defaultDate?: string
  categories: readonly Category[]
  onSubmit: (plain: OneOffFormValues) => Promise<void>
  onCancel: () => void
  submitLabel?: string
  cancelLabel?: string
  isLoading?: boolean
}

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

export function OneOffForm({
  ref,
  initial,
  defaultDate,
  categories,
  onSubmit,
  onCancel,
  submitLabel = 'Add',
  cancelLabel = 'Cancel',
  isLoading,
}: Props) {
  const baseline = useMemo(
    () => ({
      name: initial?.name ?? '',
      amount: initial ? (initial.amount / 100).toFixed(2) : '',
      category: (initial?.category ?? categories[0]) as Category,
      date: initial?.date ?? defaultDate ?? todayISO(),
    }),
    [initial, defaultDate, categories],
  )

  const [name, setName] = useState(baseline.name)
  const [amount, setAmount] = useState(baseline.amount)
  const [category, setCategory] = useState<Category>(baseline.category)
  const [date, setDate] = useState(baseline.date)

  const isDirty =
    name !== baseline.name ||
    amount !== baseline.amount ||
    category !== baseline.category ||
    date !== baseline.date

  useImperativeHandle(ref, () => ({ isDirty: () => isDirty }), [isDirty])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const pence = Math.round(parseFloat(amount) * 100)
    await onSubmit({ name: name.trim(), amount: pence, category, date })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="one-name">Name</Label>
        <Input
          id="one-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Birthday gift, train ticket…"
          autoFocus
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="one-amount">Amount (£)</Label>
          <Input
            id="one-amount"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="one-category">Category</Label>
          <Select
            value={category}
            onValueChange={(v) => setCategory(v as Category)}
          >
            <SelectTrigger id="one-category" className="capitalize">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c} value={c} className="capitalize">
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="one-date">Date</Label>
        <DatePicker id="one-date" value={date} onChange={setDate} />
      </div>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {submitLabel}
        </Button>
      </DialogFooter>
    </form>
  )
}
