import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api'
import {
  Check, Trash2, Package, ChevronDown, ChevronRight,
  Clock, Link2, Store, ImageIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import type { ProjectItem, Supplier } from './types'
import { formatTime, formatCurrency } from './helpers'

interface ItemsTabProps {
  items: ProjectItem[]
  projectId: number
  onToggleItem: (id: number, currentStatus: string) => void
  onDeleteItem: (id: number) => void
}

export function ItemsTab({ items, projectId, onToggleItem, onDeleteItem }: ItemsTabProps) {
  const [filter, setFilter] = useState<'all' | 'make' | 'buy'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'done'>('all')

  const nonTaskItems = items.filter(i => i.item_type !== 'task')
  let filtered = nonTaskItems

  if (filter !== 'all') filtered = filtered.filter(i => i.item_type === filter)
  if (statusFilter === 'pending') filtered = filtered.filter(i => i.status !== 'completed')
  if (statusFilter === 'done') filtered = filtered.filter(i => i.status === 'completed')

  const makeItems = filtered.filter(i => i.item_type === 'make').sort((a, b) => a.sort_order - b.sort_order)
  const buyItems = filtered.filter(i => i.item_type === 'buy').sort((a, b) => a.sort_order - b.sort_order)

  if (nonTaskItems.length === 0) {
    return (
      <div className="text-center py-10">
        <Package size={24} className="mx-auto text-text-faint mb-2" />
        <p className="text-[13px] text-text-muted">No items yet.</p>
        <p className="text-[11px] text-text-faint mt-1">Add items to track what you need to make or buy.</p>
      </div>
    )
  }

  return (
    <div className="py-3 space-y-4">
      {/* Filter bar */}
      <div className="flex items-center gap-1.5">
        {(['all', 'make', 'buy'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-2.5 h-6 rounded text-[10px] font-medium transition-colors border',
              filter === f
                ? 'bg-accent-dim text-accent border-accent/25'
                : 'bg-transparent text-text-faint border-border hover:border-border-bright hover:text-text-muted',
            )}
          >
            {f === 'all' ? 'All' : f === 'make' ? 'Make' : 'Buy'}
          </button>
        ))}
        <div className="w-px h-4 bg-border mx-1" />
        {(['all', 'pending', 'done'] as const).map(f => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            className={cn(
              'px-2.5 h-6 rounded text-[10px] font-medium transition-colors border',
              statusFilter === f
                ? 'bg-accent-dim text-accent border-accent/25'
                : 'bg-transparent text-text-faint border-border hover:border-border-bright hover:text-text-muted',
            )}
          >
            {f === 'all' ? 'All' : f === 'pending' ? 'Pending' : 'Done'}
          </button>
        ))}
        <div className="flex-1" />
        <span className="text-[10px] text-text-faint">
          {filtered.length} item{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Make section */}
      {(filter === 'all' || filter === 'make') && makeItems.length > 0 && (
        <div>
          <div className="text-label mb-1.5 px-0.5 flex items-center gap-2">
            Make <span className="text-text-faint font-normal">{makeItems.length}</span>
            <div className="flex-1 h-px bg-border" />
          </div>
          <div className="space-y-0.5">
            {makeItems.map(item => (
              <ExpandableItemRow
                key={item.id}
                item={item}
                onToggle={() => onToggleItem(item.id, item.status)}
                onDelete={() => onDeleteItem(item.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Buy section */}
      {(filter === 'all' || filter === 'buy') && buyItems.length > 0 && (
        <div>
          <div className="text-label mb-1.5 px-0.5 flex items-center gap-2">
            Buy <span className="text-text-faint font-normal">{buyItems.length}</span>
            <div className="flex-1 h-px bg-border" />
          </div>
          <div className="space-y-0.5">
            {buyItems.map(item => (
              <ExpandableItemRow
                key={item.id}
                item={item}
                onToggle={() => onToggleItem(item.id, item.status)}
                onDelete={() => onDeleteItem(item.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ExpandableItemRow({
  item, onToggle, onDelete,
}: {
  item: ProjectItem
  onToggle: () => void
  onDelete: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const completed = item.status === 'completed'

  // Fetch suppliers for this item when expanded
  const { data: suppliers } = useQuery({
    queryKey: ['item-suppliers', item.id],
    queryFn: () => apiGet<Supplier[]>(`/modules/craftplanner/items/${item.id}/suppliers`),
    enabled: expanded,
  })

  return (
    <div className={cn('rounded border transition-colors', expanded ? 'border-accent/20 bg-surface' : 'border-border hover:border-border-bright')}>
      {/* Main row */}
      <div
        className="flex items-center gap-2.5 px-2.5 py-2 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <button
          onClick={e => { e.stopPropagation(); setExpanded(!expanded) }}
          className="text-text-faint hover:text-text-muted shrink-0"
        >
          {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        </button>
        <button
          onClick={e => { e.stopPropagation(); onToggle() }}
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
        <Badge
          variant={item.item_type === 'buy' ? 'accent' : 'purple'}
          size="sm"
          className="text-[9px]"
        >
          {item.item_type}
        </Badge>
        {item.quantity > 1 && (
          <span className="text-[10px] text-text-faint font-mono">{item.quantity} {item.unit}</span>
        )}
        {item.estimated_cost != null && (
          <span className="text-[10px] text-text-faint font-mono">{formatCurrency(item.estimated_cost)}</span>
        )}
        {item.actual_time_minutes > 0 && (
          <span className="text-[10px] text-text-faint font-mono flex items-center gap-0.5">
            <Clock size={9} /> {formatTime(item.actual_time_minutes)}
          </span>
        )}
      </div>

      {/* Expanded detail panel */}
      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-border/50 space-y-2.5">
          {item.description && (
            <p className="text-[11px] text-text-muted leading-relaxed">{item.description}</p>
          )}

          {/* Detail fields */}
          <div className="flex gap-4 flex-wrap text-[10px]">
            <div>
              <span className="text-label">Quantity</span>
              <div className="text-text font-mono mt-0.5">{item.quantity} {item.unit}</div>
            </div>
            {item.estimated_cost != null && (
              <div>
                <span className="text-label">Est. Cost</span>
                <div className="text-text font-mono mt-0.5">{formatCurrency(item.estimated_cost)}</div>
              </div>
            )}
            {item.estimated_time_minutes != null && (
              <div>
                <span className="text-label">Est. Time</span>
                <div className="text-text font-mono mt-0.5">{formatTime(item.estimated_time_minutes)}</div>
              </div>
            )}
            {item.actual_time_minutes > 0 && (
              <div>
                <span className="text-label">Time Logged</span>
                <div className="text-text font-mono mt-0.5">{formatTime(item.actual_time_minutes)}</div>
              </div>
            )}
          </div>

          {/* Linked primitive */}
          {item.primitive_path && (
            <div className="flex items-center gap-1.5">
              <Link2 size={10} className="text-text-faint" />
              <span className="text-[10px] bg-accent-muted text-accent px-1.5 py-0.5 rounded border border-accent/15">
                {item.primitive_path.split('/').pop()?.replace(/\.json$/, '') || item.primitive_path}
              </span>
            </div>
          )}

          {/* Linked suppliers */}
          {suppliers && suppliers.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <Store size={10} className="text-text-faint" />
              {suppliers.map(s => (
                <span key={s.id} className="text-[10px] bg-surface-el text-text-muted px-1.5 py-0.5 rounded border border-border">
                  {s.name}
                </span>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-1.5 pt-1">
            <Button variant="ghost" size="xs" onClick={onDelete} className="text-danger hover:text-danger">
              <Trash2 size={10} /> Delete
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
