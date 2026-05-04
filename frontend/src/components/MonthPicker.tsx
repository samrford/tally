import { useState } from 'react'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

const MONTH_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

function ymToParts(ym: string): { year: number; month: number } {
  const [y, m] = ym.split('-').map(Number)
  return { year: y, month: m }
}

function partsToYm(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

function prettyYM(ym: string): string {
  const { year, month } = ymToParts(ym)
  return `${MONTH_LONG[month - 1]} ${year}`
}

interface MonthPickerProps {
  value: string // 'YYYY-MM'
  onChange: (value: string) => void
  className?: string
  ariaLabel?: string
}

export function MonthPicker({
  value,
  onChange,
  className,
  ariaLabel,
}: MonthPickerProps) {
  const [open, setOpen] = useState(false)
  const selected = ymToParts(value)
  const [viewYear, setViewYear] = useState(selected.year)

  const today = new Date()
  const currentYear = today.getFullYear()
  const currentMonth = today.getMonth() + 1

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) setViewYear(selected.year)
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-label={ariaLabel}
          className={cn(
            'h-9 justify-start text-left font-normal',
            className,
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 opacity-60 shrink-0" />
          {prettyYM(value)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <div className="flex items-center justify-between mb-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-7 opacity-60 hover:opacity-100"
            onClick={() => setViewYear((y) => y - 1)}
            aria-label="Previous year"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium tabular-nums">{viewYear}</span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-7 opacity-60 hover:opacity-100"
            onClick={() => setViewYear((y) => y + 1)}
            aria-label="Next year"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {MONTHS.map((label, idx) => {
            const m = idx + 1
            const isSelected = viewYear === selected.year && m === selected.month
            const isCurrent = viewYear === currentYear && m === currentMonth
            return (
              <Button
                key={label}
                type="button"
                variant={isSelected ? 'default' : 'ghost'}
                className={cn(
                  'h-9 text-sm font-normal',
                  !isSelected && isCurrent && 'bg-accent text-accent-foreground',
                )}
                onClick={() => {
                  onChange(partsToYm(viewYear, m))
                  setOpen(false)
                }}
              >
                {label}
              </Button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
