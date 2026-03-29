import { Link } from '@tanstack/react-router'
import { Plus, Clock, DollarSign, ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export function ActionBar({
  projectId,
  onAddItem,
  onLogTime,
  onAddCost,
}: {
  projectId: number
  onAddItem: () => void
  onLogTime: () => void
  onAddCost: () => void
}) {
  return (
    <div className="sticky bottom-0 border-t border-border bg-bg/90 backdrop-blur px-4 py-2 flex items-center gap-2">
      <Button variant="primary" size="xs" onClick={onAddItem}>
        <Plus size={10} /> Add Item
      </Button>
      <Button variant="secondary" size="xs" onClick={onLogTime}>
        <Clock size={10} /> Log Time
      </Button>
      <Button variant="secondary" size="xs" onClick={onAddCost}>
        <DollarSign size={10} /> Add Cost
      </Button>
      <div className="flex-1" />
      <Link
        to={`/shopping-list?project=${projectId}` as never}
        className="inline-flex items-center gap-1.5 text-[11px] text-text-muted hover:text-accent transition-colors"
      >
        <ShoppingCart size={11} />
        Shopping List
      </Link>
    </div>
  )
}
