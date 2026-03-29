import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api'
import { Plus, Receipt, Store } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Dialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import type { CostData, Supplier } from './types'
import { formatCurrency, formatDate } from './helpers'

const CATEGORY_COLORS: Record<string, string> = {
  materials: 'bg-accent',
  tools: 'bg-sky-400',
  services: 'bg-violet-400',
  shipping: 'bg-teal-400',
  other: 'bg-text-faint',
}

const CATEGORY_OPTIONS = [
  { value: 'materials', label: 'Materials' },
  { value: 'tools', label: 'Tools' },
  { value: 'services', label: 'Services' },
  { value: 'shipping', label: 'Shipping' },
  { value: 'other', label: 'Other' },
]

export function BudgetTab({ projectId, budget }: { projectId: number; budget: number | null }) {
  const [showAddCost, setShowAddCost] = useState(false)

  const { data: costData, isLoading } = useQuery({
    queryKey: ['project-costs', projectId],
    queryFn: () => apiGet<CostData>('/modules/craftplanner/costs/' + projectId),
  })

  if (isLoading) {
    return <div className="py-10 text-center text-[12px] text-text-faint">Loading budget data...</div>
  }

  const entries = costData?.entries ?? []
  const totalEstimated = costData?.total_estimated ?? 0
  const totalActual = costData?.total_actual ?? 0
  const remaining = (budget ?? 0) - totalActual

  // Category breakdown
  const categories = ['materials', 'tools', 'services', 'shipping', 'other']
  const categoryTotals: Record<string, number> = {}
  for (const cat of categories) categoryTotals[cat] = 0
  for (const entry of entries) {
    const cat = categories.includes(entry.category) ? entry.category : 'other'
    categoryTotals[cat] += entry.amount
  }
  const totalForBar = Object.values(categoryTotals).reduce((a, b) => a + b, 0)

  const sortedEntries = [...entries].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )

  return (
    <div className="py-3 space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Budget', value: budget != null ? formatCurrency(budget) : '--' },
          { label: 'Estimated', value: formatCurrency(totalEstimated) },
          { label: 'Actual Spent', value: formatCurrency(totalActual) },
          { label: 'Remaining', value: budget != null ? formatCurrency(remaining) : '--', color: budget != null ? (remaining < 0 ? 'text-danger' : 'text-success') : undefined },
        ].map(card => (
          <div key={card.label} className="rounded border border-border bg-surface/50 px-2.5 py-2">
            <div className="text-[9px] uppercase tracking-wider text-text-faint mb-0.5">{card.label}</div>
            <div className={cn('text-[16px] font-semibold font-display', card.color || 'text-text')}>
              {card.value}
            </div>
          </div>
        ))}
      </div>

      {/* Category stacked bar */}
      {totalForBar > 0 && (
        <div>
          <div className="text-label mb-2 px-0.5">Spend Breakdown</div>
          <div className="h-2 rounded-full bg-surface-el overflow-hidden flex gap-px">
            {categories.map(cat => {
              const pct = (categoryTotals[cat] / totalForBar) * 100
              if (pct === 0) return null
              return (
                <div
                  key={cat}
                  className={cn('h-full rounded-full', CATEGORY_COLORS[cat])}
                  style={{ width: `${pct}%` }}
                />
              )
            })}
          </div>
          <div className="flex gap-3 flex-wrap mt-2">
            {categories.map(cat => {
              if (categoryTotals[cat] === 0) return null
              return (
                <div key={cat} className="flex items-center gap-1.5 text-[10px] text-text-muted">
                  <span className={cn('w-2 h-2 rounded-full', CATEGORY_COLORS[cat])} />
                  <span className="capitalize">{cat}</span>
                  <span className="font-mono">{formatCurrency(categoryTotals[cat])}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Cost entries */}
      <div>
        <div className="flex items-center justify-between mb-2 px-0.5">
          <div className="text-label">Cost Entries</div>
          <Button variant="secondary" size="xs" onClick={() => setShowAddCost(true)}>
            <Plus size={10} /> Add Cost
          </Button>
        </div>

        {sortedEntries.length === 0 ? (
          <div className="text-center py-8">
            <Receipt size={22} className="mx-auto text-text-faint mb-2" />
            <p className="text-[12px] text-text-muted">No cost entries yet.</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {sortedEntries.map(entry => (
              <div
                key={entry.id}
                className="flex items-center gap-2.5 px-2.5 py-2 bg-surface border border-border rounded text-[11px]"
              >
                <Badge variant="default" size="sm" className="text-[9px] capitalize">{entry.category}</Badge>
                <div className="flex-1 min-w-0">
                  <span className="text-text">{entry.description}</span>
                  {entry.supplier_name && (
                    <span className="text-text-faint ml-1.5 inline-flex items-center gap-0.5">
                      <Store size={8} /> {entry.supplier_name}
                    </span>
                  )}
                </div>
                {entry.is_estimate === 1 && <Badge variant="warning" size="sm">est.</Badge>}
                <span className="font-mono font-medium text-text">{formatCurrency(entry.amount)}</span>
                <span className="text-[10px] text-text-faint font-mono">{formatDate(entry.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <AddCostDialog projectId={projectId} open={showAddCost} onOpenChange={setShowAddCost} />
    </div>
  )
}

function AddCostDialog({
  projectId, open, onOpenChange,
}: {
  projectId: number
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [category, setCategory] = useState('materials')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [isEstimate, setIsEstimate] = useState(false)
  const [receiptRef, setReceiptRef] = useState('')
  const [supplierId, setSupplierId] = useState('')

  const { data: suppliers } = useQuery({
    queryKey: ['craftplanner', 'suppliers'],
    queryFn: () => apiGet<Supplier[]>('/modules/craftplanner/suppliers'),
  })

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiPost('/modules/craftplanner/costs', data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['project-costs', projectId] })
      void queryClient.invalidateQueries({ queryKey: ['project-progress', projectId] })
      resetForm()
      onOpenChange(false)
    },
  })

  function resetForm() {
    setCategory('materials')
    setDescription('')
    setAmount('')
    setIsEstimate(false)
    setReceiptRef('')
    setSupplierId('')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!description.trim() || !amount) return
    mutation.mutate({
      project_id: projectId,
      category,
      description: description.trim(),
      amount: parseFloat(amount),
      is_estimate: isEstimate ? 1 : 0,
      receipt_ref: receiptRef.trim() || null,
      supplier_id: supplierId ? parseInt(supplierId) : null,
    })
  }

  const supplierOptions = [
    { value: '', label: 'No supplier' },
    ...(suppliers ?? []).map(s => ({ value: String(s.id), label: s.name })),
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Add Cost">
      <form onSubmit={handleSubmit} className="space-y-3">
        <Select label="Category" value={category} onValueChange={setCategory} options={CATEGORY_OPTIONS} />
        <Input label="Description" value={description} onChange={e => setDescription(e.target.value)} placeholder="What was this cost for?" required autoFocus />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Amount" type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" required />
          <Select label="Supplier" value={supplierId} onValueChange={setSupplierId} options={supplierOptions} />
        </div>
        <label className="flex items-center gap-2 text-[12px] text-text-muted cursor-pointer">
          <input type="checkbox" checked={isEstimate} onChange={e => setIsEstimate(e.target.checked)} className="rounded border-border" />
          This is an estimate
        </label>
        <Input label="Receipt Reference" value={receiptRef} onChange={e => setReceiptRef(e.target.value)} placeholder="Receipt # or link" />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" variant="primary" size="sm" disabled={!description.trim() || !amount || mutation.isPending}>
            {mutation.isPending ? 'Adding...' : 'Add Cost'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
