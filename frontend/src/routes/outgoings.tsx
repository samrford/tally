import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ThemeToggle } from '@/components/ThemeToggle'
import { OutgoingForm } from '@/components/OutgoingForm'
import { useKeystore } from '@/lib/keystore'
import { requireUnlocked } from '@/lib/routeGuards'
import {
  useOutgoings,
  useCreateOutgoing,
  useUpdateOutgoing,
  useDeleteOutgoing,
  type Outgoing,
} from '@/lib/outgoings'

export const Route = createFileRoute('/outgoings')({
  beforeLoad: ({ context }) => requireUnlocked(context),
  component: OutgoingsPage,
})

const gbp = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
})

function formatGBP(pence: number): string {
  return gbp.format(pence / 100)
}

function OutgoingsPage() {
  const { dek } = useKeystore()
  const [editingId, setEditingId] = useState<string | null>(null)

  const { data, isLoading } = useOutgoings(dek)
  const create = useCreateOutgoing(dek)
  const update = useUpdateOutgoing(dek)
  const del = useDeleteOutgoing()

  const editing = data?.find((o) => o.id === editingId)

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-3xl mx-auto space-y-6">
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
          <CardContent className="pt-6">
            {editing ? (
              <OutgoingForm
                key={editing.id}
                initial={{
                  amount: editing.amount,
                  category: editing.category,
                  description: editing.description,
                  date: editing.date,
                }}
                submitLabel="Save"
                isLoading={update.isPending}
                onSubmit={async (plain) => {
                  await update.mutateAsync({ id: editing.id, plain })
                  setEditingId(null)
                }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <OutgoingForm
                onSubmit={async (plain) => {
                  await create.mutateAsync(plain)
                }}
                isLoading={create.isPending}
              />
            )}
          </CardContent>
        </Card>

        <div className="space-y-2">
          {isLoading && (
            <p className="text-muted-foreground">Loading…</p>
          )}
          {data && data.length === 0 && !isLoading && (
            <p className="text-muted-foreground text-center py-8">
              No outgoings yet. Add your first one above.
            </p>
          )}
          {data?.map((o) => (
            <OutgoingRow
              key={o.id}
              outgoing={o}
              onEdit={() => setEditingId(o.id)}
              onDelete={() => {
                if (window.confirm('Delete this outgoing?')) del.mutate(o.id)
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function OutgoingRow({
  outgoing,
  onEdit,
  onDelete,
}: {
  outgoing: Outgoing
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-md border bg-card">
      <div className="text-xs text-muted-foreground tabular-nums w-24 shrink-0">
        {outgoing.date}
      </div>
      <div className="text-xs font-medium uppercase text-primary w-16 shrink-0">
        {outgoing.category}
      </div>
      <div className="font-medium tabular-nums w-24 shrink-0">
        {formatGBP(outgoing.amount)}
      </div>
      <div className="flex-1 text-sm text-muted-foreground truncate">
        {outgoing.description}
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
