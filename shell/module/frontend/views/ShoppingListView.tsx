import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPut } from '@/lib/api'
import { Check, ShoppingCart, Store } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Select } from '@/components/ui/Select'

/* ---------- Types ---------- */

interface ShoppingItem {
  id: number
  name: string
  quantity: number
  unit: string
  estimated_cost: number | null
  status: string
  supplier_name?: string | null
}

interface ShoppingGroup {
  project_id: number
  project_name: string
  items: ShoppingItem[]
  total_estimated: number
}

interface ShoppingListData {
  groups: ShoppingGroup[]
  total_estimated: number
}

/* ---------- Helpers ---------- */

function formatCurrency(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/* ========== Main Component ========== */

export function ShoppingListView() {
  const [projectFilter, setProjectFilter] = useState('')
  const [groupBy, setGroupBy] = useState<'project' | 'supplier'>('project')
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['shopping-list'],
    queryFn: () => apiGet<ShoppingListData>('/modules/craftplanner/shopping-list'),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiPut(`/modules/craftplanner/items/${id}`, { status }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['shopping-list'] })
    },
  })

  const shoppingList = data ?? { groups: [], total_estimated: 0 }

  const projectOptions = useMemo(() => {
    const opts = [{ value: '', label: 'All projects' }]
    for (const group of shoppingList.groups) {
      opts.push({ value: String(group.project_id), label: group.project_name })
    }
    return opts
  }, [shoppingList.groups])

  const filteredGroups = useMemo(() => {
    if (!projectFilter) return shoppingList.groups
    return shoppingList.groups.filter(g => String(g.project_id) === projectFilter)
  }, [shoppingList.groups, projectFilter])

  // All items flat (for supplier grouping)
  const allItems = useMemo(() => {
    return filteredGroups.flatMap(g => g.items.map(i => ({ ...i, project_name: g.project_name })))
  }, [filteredGroups])

  // Supplier groups
  const supplierGroups = useMemo(() => {
    if (groupBy !== 'supplier') return []
    const map = new Map<string, (ShoppingItem & { project_name: string })[]>()
    for (const item of allItems) {
      const key = item.supplier_name || 'No supplier'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(item)
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a === 'No supplier' ? 1 : b === 'No supplier' ? -1 : a.localeCompare(b))
  }, [allItems, groupBy])

  const hasItems = filteredGroups.some(g => g.items.length > 0)

  const grandTotal = useMemo(
    () => filteredGroups.reduce((sum, g) => sum + g.total_estimated, 0),
    [filteredGroups],
  )

  const totalItemCount = useMemo(
    () => filteredGroups.reduce((sum, g) => sum + g.items.filter(i => i.status !== 'completed').length, 0),
    [filteredGroups],
  )

  if (isLoading) {
    return (
      <div className="p-5 max-w-3xl mx-auto">
        <div className="animate-pulse space-y-3">
          <div className="h-8 w-48 bg-surface rounded" />
          <div className="h-3 w-64 bg-surface rounded" />
          <div className="space-y-2 mt-6">
            {[1, 2, 3].map(i => <div key={i} className="h-14 bg-surface rounded" />)}
          </div>
        </div>
      </div>
    )
  }

  function renderItem(item: ShoppingItem & { project_name?: string }, showProject?: boolean) {
    const completed = item.status === 'completed'
    return (
      <div
        key={item.id}
        className="flex items-center gap-2.5 px-3 py-2 hover:bg-surface-hover transition-colors"
      >
        <button
          onClick={() => toggleMutation.mutate({ id: item.id, status: completed ? 'pending' : 'completed' })}
          className={cn(
            'w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors',
            completed ? 'bg-success border-success text-bg' : 'border-border-bright hover:border-accent',
          )}
        >
          {completed && <Check size={9} />}
        </button>
        <span className={cn('flex-1 text-[12px] min-w-0 truncate', completed ? 'line-through text-text-faint' : 'text-text')}>
          {item.name}
        </span>
        {showProject && item.project_name && (
          <span className="text-[9px] text-text-faint truncate max-w-24">{item.project_name}</span>
        )}
        {item.supplier_name && groupBy === 'project' && (
          <span className="text-[9px] text-text-faint flex items-center gap-0.5 shrink-0">
            <Store size={7} /> {item.supplier_name}
          </span>
        )}
        <span className="text-[10px] text-text-faint shrink-0 font-mono">
          {item.quantity}{item.unit ? ` ${item.unit}` : ''}
        </span>
        {item.estimated_cost != null && (
          <span className={cn('text-[10px] shrink-0 font-mono w-14 text-right', completed ? 'text-text-faint' : 'text-text-muted')}>
            {formatCurrency(item.estimated_cost)}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="p-5 max-w-3xl mx-auto">
      <div className="flex items-start justify-between mb-1">
        <h1 className="text-[22px] font-display text-text leading-tight">Shopping List</h1>
        {totalItemCount > 0 && (
          <Badge variant="muted" size="sm">{totalItemCount} item{totalItemCount !== 1 ? 's' : ''}</Badge>
        )}
      </div>
      <p className="text-[11px] text-text-faint mb-4">Items you need to buy across your projects</p>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4">
        {shoppingList.groups.length > 1 && (
          <Select value={projectFilter} onValueChange={setProjectFilter} options={projectOptions} placeholder="All projects" className="min-w-[150px]" />
        )}
        <div className="flex gap-0.5">
          {(['project', 'supplier'] as const).map(g => (
            <button
              key={g}
              onClick={() => setGroupBy(g)}
              className={cn(
                'px-2.5 h-6 rounded text-[10px] font-medium border transition-colors',
                groupBy === g
                  ? 'bg-accent-dim text-accent border-accent/25'
                  : 'bg-transparent text-text-faint border-border hover:text-text-muted',
              )}
            >
              {g === 'project' ? 'By Project' : 'By Supplier'}
            </button>
          ))}
        </div>
      </div>

      {!hasItems ? (
        <div className="text-center py-12 bg-surface rounded border border-border">
          <ShoppingCart size={28} className="mx-auto text-text-faint mb-3" />
          <p className="text-[13px] text-text-muted mb-1">Nothing to buy!</p>
          <p className="text-[11px] text-text-faint">All items are completed or you haven't added buy items.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupBy === 'project' ? (
            filteredGroups.map(group => {
              if (group.items.length === 0) return null
              const sorted = [...group.items].sort((a, b) => {
                if (a.status === 'completed' && b.status !== 'completed') return 1
                if (a.status !== 'completed' && b.status === 'completed') return -1
                return 0
              })
              const pendingCount = group.items.filter(i => i.status !== 'completed').length
              return (
                <div key={group.project_id}>
                  <div className="flex items-center justify-between mb-1.5 px-0.5">
                    <span className="text-label">{group.project_name}</span>
                    <span className="text-[10px] text-text-faint">
                      {pendingCount} item{pendingCount !== 1 ? 's' : ''}
                      {group.total_estimated > 0 && ` \u00b7 est. ${formatCurrency(group.total_estimated)}`}
                    </span>
                  </div>
                  <div className="rounded border border-border bg-surface divide-y divide-border">
                    {sorted.map(item => renderItem(item))}
                  </div>
                </div>
              )
            })
          ) : (
            supplierGroups.map(([supplierName, items]) => {
              const sorted = [...items].sort((a, b) => {
                if (a.status === 'completed' && b.status !== 'completed') return 1
                if (a.status !== 'completed' && b.status === 'completed') return -1
                return 0
              })
              const pendingCount = items.filter(i => i.status !== 'completed').length
              const total = items.reduce((s, i) => s + (i.estimated_cost ?? 0), 0)
              return (
                <div key={supplierName}>
                  <div className="flex items-center justify-between mb-1.5 px-0.5">
                    <span className="text-label flex items-center gap-1">
                      <Store size={10} /> {supplierName}
                    </span>
                    <span className="text-[10px] text-text-faint">
                      {pendingCount} item{pendingCount !== 1 ? 's' : ''}
                      {total > 0 && ` \u00b7 est. ${formatCurrency(total)}`}
                    </span>
                  </div>
                  <div className="rounded border border-border bg-surface divide-y divide-border">
                    {sorted.map(item => renderItem(item, true))}
                  </div>
                </div>
              )
            })
          )}

          {grandTotal > 0 && (
            <div className="border-t border-border pt-3 flex items-center justify-between">
              <span className="text-[12px] font-medium text-text-muted">Estimated Total</span>
              <span className="text-[13px] font-semibold font-display text-text font-mono">{formatCurrency(grandTotal)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
