import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPut } from '@/lib/api'
import { Check, ShoppingCart } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardBody } from '@/components/ui/Card'
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
  const queryClient = useQueryClient()

  /* ---------- Queries ---------- */

  const { data, isLoading } = useQuery({
    queryKey: ['shopping-list'],
    queryFn: () => apiGet<ShoppingListData>('/modules/craftplanner/shopping-list'),
  })

  /* ---------- Mutations ---------- */

  const toggleMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiPut(`/modules/craftplanner/items/${id}`, { status }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['shopping-list'] })
    },
  })

  /* ---------- Derived ---------- */

  const shoppingList = data ?? { groups: [], total_estimated: 0 }

  const projectOptions = useMemo(() => {
    const opts = [{ value: '', label: 'All projects' }]
    for (const group of shoppingList.groups) {
      opts.push({
        value: String(group.project_id),
        label: group.project_name,
      })
    }
    return opts
  }, [shoppingList.groups])

  const filteredGroups = useMemo(() => {
    if (!projectFilter) return shoppingList.groups
    return shoppingList.groups.filter(
      g => String(g.project_id) === projectFilter,
    )
  }, [shoppingList.groups, projectFilter])

  const hasItems = filteredGroups.some(g => g.items.length > 0)

  const grandTotal = useMemo(
    () => filteredGroups.reduce((sum, g) => sum + g.total_estimated, 0),
    [filteredGroups],
  )

  const totalItemCount = useMemo(
    () =>
      filteredGroups.reduce(
        (sum, g) => sum + g.items.filter(i => i.status !== 'completed').length,
        0,
      ),
    [filteredGroups],
  )

  /* ---------- Loading ---------- */

  if (isLoading) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-surface rounded" />
          <div className="h-4 w-64 bg-surface rounded" />
          <div className="space-y-3 mt-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-surface rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  /* ---------- Render ---------- */

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-1">
        <h1
          className="text-2xl"
          style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
        >
          Shopping List
        </h1>
        {totalItemCount > 0 && (
          <Badge variant="muted">{totalItemCount} item{totalItemCount !== 1 ? 's' : ''}</Badge>
        )}
      </div>
      <p className="text-xs text-text-faint mb-5">
        Items you need to buy across your projects
      </p>

      {/* Filter */}
      {shoppingList.groups.length > 1 && (
        <div className="mb-5">
          <Select
            value={projectFilter}
            onValueChange={setProjectFilter}
            options={projectOptions}
            placeholder="All projects"
            className="min-w-[180px]"
          />
        </div>
      )}

      {/* Empty state */}
      {!hasItems ? (
        <div className="text-center py-16 bg-surface rounded-lg border border-border">
          <ShoppingCart size={32} className="mx-auto text-text-faint mb-3" />
          <p className="text-text-muted mb-1">Nothing to buy!</p>
          <p className="text-xs text-text-faint">
            All items are either completed or you haven't added any buy items to
            your projects.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredGroups.map(group => {
            if (group.items.length === 0) return null

            // Sort: pending items first, completed at bottom
            const sorted = [...group.items].sort((a, b) => {
              if (a.status === 'completed' && b.status !== 'completed') return 1
              if (a.status !== 'completed' && b.status === 'completed') return -1
              return 0
            })

            const pendingCount = group.items.filter(
              i => i.status !== 'completed',
            ).length

            return (
              <div key={group.project_id}>
                {/* Group header */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-text-muted uppercase tracking-wide">
                    {group.project_name}
                  </span>
                  <span className="text-xs text-text-faint">
                    {pendingCount} item{pendingCount !== 1 ? 's' : ''}
                    {group.total_estimated > 0 &&
                      `, est. ${formatCurrency(group.total_estimated)}`}
                  </span>
                </div>

                {/* Items */}
                <Card>
                  <CardBody className="p-0">
                    <div className="divide-y divide-border">
                      {sorted.map(item => {
                        const completed = item.status === 'completed'

                        return (
                          <div
                            key={item.id}
                            className="flex items-center gap-3 px-4 py-2.5 group hover:bg-surface-el/50 transition-colors"
                          >
                            {/* Checkbox */}
                            <button
                              onClick={() =>
                                toggleMutation.mutate({
                                  id: item.id,
                                  status: completed ? 'pending' : 'completed',
                                })
                              }
                              className={cn(
                                'w-[18px] h-[18px] rounded border flex items-center justify-center shrink-0 transition-colors',
                                completed
                                  ? 'bg-success border-success text-bg'
                                  : 'border-border-bright hover:border-accent',
                              )}
                              aria-label={
                                completed
                                  ? 'Mark as not purchased'
                                  : 'Mark as purchased'
                              }
                            >
                              {completed && <Check size={11} />}
                            </button>

                            {/* Name */}
                            <span
                              className={cn(
                                'flex-1 text-sm min-w-0 truncate',
                                completed
                                  ? 'line-through text-text-faint'
                                  : 'text-text',
                              )}
                            >
                              {item.name}
                            </span>

                            {/* Quantity + unit */}
                            <span className="text-xs text-text-faint shrink-0">
                              {item.quantity}
                              {item.unit ? ` ${item.unit}` : ''}
                            </span>

                            {/* Cost */}
                            {item.estimated_cost != null && (
                              <span
                                className={cn(
                                  'text-xs shrink-0 tabular-nums w-16 text-right',
                                  completed
                                    ? 'text-text-faint'
                                    : 'text-text-muted',
                                )}
                              >
                                {formatCurrency(item.estimated_cost)}
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </CardBody>
                </Card>
              </div>
            )
          })}

          {/* Grand total */}
          {grandTotal > 0 && (
            <div className="border-t border-border pt-4 flex items-center justify-between">
              <span className="text-sm font-medium text-text-muted">
                Estimated Total
              </span>
              <span className="text-sm font-semibold text-text tabular-nums">
                {formatCurrency(grandTotal)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
