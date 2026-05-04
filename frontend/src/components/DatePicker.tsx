import { useState } from 'react'
import { format } from 'date-fns'
import { Calendar as CalendarIcon, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

// Local-time parse/format — keeps the date the user sees identical to what
// we send to the server (no UTC drift on the boundary).
function parseLocalISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function formatLocalISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

interface DatePickerProps {
  value: string // 'YYYY-MM-DD' or '' for none
  onChange: (value: string) => void
  placeholder?: string
  optional?: boolean
  disabled?: (date: Date) => boolean
  id?: string
  className?: string
  ariaLabel?: string
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'Pick a date',
  optional,
  disabled,
  id,
  className,
  ariaLabel,
}: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const selected = value ? parseLocalISO(value) : undefined

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          aria-label={ariaLabel}
          className={cn(
            'w-full h-9 justify-start text-left font-normal pr-2',
            !value && 'text-muted-foreground',
            className,
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 opacity-60 shrink-0" />
          <span className="flex-1 truncate">
            {selected ? format(selected, 'd MMM yyyy') : placeholder}
          </span>
          {optional && value && (
            <span
              role="button"
              tabIndex={0}
              aria-label="Clear date"
              className="ml-1 -mr-1 inline-flex items-center justify-center size-5 rounded-sm opacity-60 hover:opacity-100 hover:bg-accent"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onChange('')
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  e.stopPropagation()
                  onChange('')
                }
              }}
            >
              <X className="h-3 w-3" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(d) => {
            if (d) {
              onChange(formatLocalISO(d))
              setOpen(false)
            } else if (optional) {
              onChange('')
            }
          }}
          disabled={disabled}
          defaultMonth={selected}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  )
}
