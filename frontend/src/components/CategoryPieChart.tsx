import { Pie, PieChart } from 'recharts'

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import type { Category } from '@/lib/flows'

const gbp = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
})
const formatGBP = (pence: number) => gbp.format(pence / 100)

const colorForIndex = (i: number) => `hsl(var(--chart-${(i % 7) + 1}))`

interface CategoryPieChartProps {
  data: { category: Category; pence: number }[]
  total: number
  categories: readonly Category[]
}

export function CategoryPieChart({
  data,
  total,
  categories,
}: CategoryPieChartProps) {
  const filtered = data.filter((d) => d.pence > 0)

  if (filtered.length === 0) {
    return (
      <p className="text-muted-foreground text-center py-12 text-sm">
        Nothing to chart yet.
      </p>
    )
  }

  // Stable color per category (by its index in the canonical list).
  const colorFor = (cat: Category): string => {
    const i = categories.indexOf(cat)
    return colorForIndex(i)
  }

  const config: ChartConfig = Object.fromEntries(
    categories.map((cat, i) => [
      cat,
      {
        label: cat[0].toUpperCase() + cat.slice(1),
        color: colorForIndex(i),
      },
    ]),
  )

  // Sort biggest slice first; pre-bake `fill` so cells pick up our palette
  // without relying on Recharts' default colour cycling.
  const chartData = filtered
    .map((d) => ({
      category: d.category,
      pence: d.pence,
      fill: colorFor(d.category),
    }))
    .sort((a, b) => b.pence - a.pence)

  return (
    <div className="flex flex-col md:flex-row items-center gap-8">
      <div className="relative shrink-0">
        <ChartContainer
          config={config}
          className="aspect-square h-56 w-56"
        >
          <PieChart>
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  hideLabel
                  formatter={(value, name, item) => {
                    const pence = typeof value === 'number' ? value : 0
                    const pct = total > 0 ? (pence / total) * 100 : 0
                    const fill = (item.payload as { fill?: string }).fill
                    return (
                      <div className="flex items-center gap-2 w-full">
                        <div
                          className="size-2.5 rounded-sm shrink-0"
                          style={{ background: fill }}
                        />
                        <span className="capitalize">{String(name)}</span>
                        <span className="ml-auto font-mono tabular-nums">
                          {formatGBP(pence)} · {pct.toFixed(0)}%
                        </span>
                      </div>
                    )
                  }}
                />
              }
            />
            <Pie
              data={chartData}
              dataKey="pence"
              nameKey="category"
              innerRadius="62%"
              outerRadius="100%"
              paddingAngle={2}
              strokeWidth={0}
            />
          </PieChart>
        </ChartContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Total
          </div>
          <div className="text-xl font-bold tabular-nums">
            {formatGBP(total)}
          </div>
        </div>
      </div>

      <div className="flex-1 w-full space-y-2">
        {chartData.map((d) => {
          const pct = total > 0 ? (d.pence / total) * 100 : 0
          return (
            <div key={d.category} className="flex items-center gap-3 text-sm">
              <div
                className="size-3 rounded-sm shrink-0"
                style={{ background: d.fill }}
              />
              <div className="capitalize flex-1 min-w-0 truncate">
                {d.category}
              </div>
              <div className="tabular-nums font-medium">
                {formatGBP(d.pence)}
              </div>
              <div className="text-muted-foreground text-xs tabular-nums w-10 text-right">
                {pct.toFixed(0)}%
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
