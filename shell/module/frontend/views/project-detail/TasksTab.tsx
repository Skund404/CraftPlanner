import { Check, Trash2, ListChecks } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ProjectItem } from './types'

interface TasksTabProps {
  items: ProjectItem[]
  onToggleItem: (id: number, currentStatus: string) => void
  onDeleteItem: (id: number) => void
}

export function TasksTab({ items, onToggleItem, onDeleteItem }: TasksTabProps) {
  const tasks = items
    .filter(i => i.item_type === 'task')
    .sort((a, b) => a.sort_order - b.sort_order)

  const doneCount = tasks.filter(t => t.status === 'completed').length

  if (tasks.length === 0) {
    return (
      <div className="text-center py-10">
        <ListChecks size={24} className="mx-auto text-text-faint mb-2" />
        <p className="text-[13px] text-text-muted">No tasks yet.</p>
        <p className="text-[11px] text-text-faint mt-1">Add tasks to track your to-do list for this project.</p>
      </div>
    )
  }

  return (
    <div className="py-3 space-y-3">
      <div className="flex items-center justify-between px-0.5">
        <div className="text-label flex items-center gap-2">
          Tasks
          <span className="text-text-faint font-normal">{doneCount}/{tasks.length}</span>
          <div className="flex-1 h-px bg-border" />
        </div>
      </div>

      {/* Progress bar */}
      {tasks.length > 0 && (
        <div className="h-1 rounded-full bg-surface-el overflow-hidden">
          <div
            className="h-full rounded-full bg-success transition-all"
            style={{ width: `${(doneCount / tasks.length) * 100}%` }}
          />
        </div>
      )}

      <div className="space-y-0.5">
        {tasks.map(item => {
          const completed = item.status === 'completed'
          return (
            <div
              key={item.id}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded border border-border hover:border-border-bright transition-colors group"
            >
              <button
                onClick={() => onToggleItem(item.id, item.status)}
                className={cn(
                  'w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors',
                  completed ? 'bg-success border-success text-bg' : 'border-border-bright hover:border-accent',
                )}
              >
                {completed && <Check size={9} />}
              </button>
              <div className="flex-1 min-w-0">
                <span className={cn('text-[12px]', completed ? 'line-through text-text-faint' : 'text-text')}>
                  {item.name}
                </span>
                {item.description && (
                  <p className="text-[10px] text-text-faint line-clamp-1 mt-0.5">{item.description}</p>
                )}
              </div>
              <button
                onClick={() => onDeleteItem(item.id)}
                className="text-text-faint hover:text-danger opacity-0 group-hover:opacity-100 transition-all p-0.5"
              >
                <Trash2 size={11} />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
