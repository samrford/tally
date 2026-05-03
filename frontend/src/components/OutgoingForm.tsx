import { useState, type FormEvent } from 'react'
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
import { CATEGORIES, type Category, type OutgoingPlain } from '@/lib/outgoings'

interface OutgoingFormProps {
  initial?: Omit<OutgoingPlain, 'v'>
  onSubmit: (plain: Omit<OutgoingPlain, 'v'>) => Promise<void>
  onCancel?: () => void
  submitLabel?: string
  isLoading?: boolean
}

function todayISO(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function OutgoingForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel = 'Add',
  isLoading,
}: OutgoingFormProps) {
  const [amount, setAmount] = useState(
    initial ? (initial.amount / 100).toFixed(2) : '',
  )
  const [category, setCategory] = useState<Category>(
    initial?.category ?? 'food',
  )
  const [description, setDescription] = useState(initial?.description ?? '')
  const [date, setDate] = useState(initial?.date ?? todayISO())

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const pence = Math.round(parseFloat(amount) * 100)
    await onSubmit({ amount: pence, category, description, date })
    if (!initial) {
      setAmount('')
      setDescription('')
      setDate(todayISO())
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end"
    >
      <div className="md:col-span-2 space-y-1">
        <Label htmlFor="amount">Amount (£)</Label>
        <Input
          id="amount"
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
      <div className="md:col-span-2 space-y-1">
        <Label htmlFor="category">Category</Label>
        <Select
          value={category}
          onValueChange={(v) => setCategory(v as Category)}
        >
          <SelectTrigger id="category" className="capitalize">
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
      <div className="md:col-span-4 space-y-1">
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What was it for?"
        />
      </div>
      <div className="md:col-span-2 space-y-1">
        <Label htmlFor="date">Date</Label>
        <Input
          id="date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
      </div>
      <div className="md:col-span-2 flex gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isLoading} className="flex-1">
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
