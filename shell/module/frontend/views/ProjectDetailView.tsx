import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, Plus, Clock, DollarSign, Trash2, Check, Package } from 'lucide-react'

interface Item {
  id: number
  project_id: number
  name: string
  description: string
  item_type: 'buy' | 'make'
  status: string
  estimated_cost: number | null
  actual_cost: number | null
  estimated_time_minutes: number | null
  actual_time_minutes: number
  quantity: number
  unit: string
}

interface Project {
  id: number
  name: string
  description: string
  status: string
  budget: number | null
  deadline: string | null
  completion_pct: number
  tags: string[]
  items: Item[]
}

interface Progress {
  total_items: number
  completed_items: number
  completion_pct: number
  estimated_cost: number
  actual_cost: number
  cost_spent: number
  estimated_time_minutes: number
  actual_time_minutes: number
}

const STATUS_OPTIONS = ['planning', 'active', 'paused', 'completed', 'archived']

function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

function AddItemForm({ projectId, onDone }: { projectId: number; onDone: () => void }) {
  const [name, setName] = useState('')
  const [type, setType] = useState<'buy' | 'make'>('make')
  const [cost, setCost] = useState('')
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiPost('/modules/craftplanner/items', data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['craftplanner'] })
      onDone()
    },
  })

  return (
    <form
      onSubmit={e => {
        e.preventDefault()
        if (!name.trim()) return
        mutation.mutate({
          project_id: projectId,
          name: name.trim(),
          item_type: type,
          estimated_cost: cost ? parseFloat(cost) : null,
        })
      }}
      className="flex items-center gap-2 p-3 bg-bg rounded border border-border"
    >
      <input
        autoFocus
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Item name"
        className="flex-1 bg-transparent text-sm text-text focus:outline-none"
      />
      <select
        value={type}
        onChange={e => setType(e.target.value as 'buy' | 'make')}
        className="bg-surface border border-border rounded px-2 py-1 text-xs text-text"
      >
        <option value="make">Make</option>
        <option value="buy">Buy</option>
      </select>
      <input
        type="number"
        step="0.01"
        value={cost}
        onChange={e => setCost(e.target.value)}
        placeholder="Cost"
        className="w-20 bg-surface border border-border rounded px-2 py-1 text-xs text-text"
      />
      <button type="submit" disabled={!name.trim()} className="text-accent hover:text-accent/80 disabled:opacity-30">
        <Plus size={16} />
      </button>
      <button type="button" onClick={onDone} className="text-text-faint hover:text-text text-xs">
        Cancel
      </button>
    </form>
  )
}

function LogTimeDialog({ itemId, onClose }: { itemId: number; onClose: () => void }) {
  const [minutes, setMinutes] = useState('')
  const [note, setNote] = useState('')
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (data: { minutes: number; note: string }) =>
      apiPost(`/modules/craftplanner/items/${itemId}/log-time`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['craftplanner'] })
      onClose()
    },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <form
        onClick={e => e.stopPropagation()}
        onSubmit={e => {
          e.preventDefault()
          const m = parseInt(minutes)
          if (m > 0) mutation.mutate({ minutes: m, note })
        }}
        className="bg-surface border border-border rounded-lg p-5 w-full max-w-sm shadow-xl"
      >
        <h3 className="text-sm font-medium text-text mb-3">Log Time</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-text-muted block mb-1">Minutes</label>
            <input
              autoFocus
              type="number"
              min="1"
              value={minutes}
              onChange={e => setMinutes(e.target.value)}
              className="w-full bg-bg border border-border rounded px-3 py-2 text-sm text-text focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="text-xs text-text-muted block mb-1">Note (optional)</label>
            <input
              value={note}
              onChange={e => setNote(e.target.value)}
              className="w-full bg-bg border border-border rounded px-3 py-2 text-sm text-text focus:outline-none focus:border-accent"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm text-text-muted hover:text-text">
            Cancel
          </button>
          <button type="submit" className="px-4 py-1.5 text-sm bg-accent text-bg rounded hover:bg-accent/90">
            Log
          </button>
        </div>
      </form>
    </div>
  )
}

export function ProjectDetailView({ id }: { id: string }) {
  const [showAddItem, setShowAddItem] = useState(false)
  const [logTimeItem, setLogTimeItem] = useState<number | null>(null)
  const queryClient = useQueryClient()
  const projectId = parseInt(id)

  const { data: project, isLoading } = useQuery({
    queryKey: ['craftplanner', 'project', projectId],
    queryFn: () => apiGet<Project>(`/modules/craftplanner/projects/${projectId}`),
  })

  const { data: progress } = useQuery({
    queryKey: ['craftplanner', 'project-progress', projectId],
    queryFn: () => apiGet<Progress>(`/modules/craftplanner/projects/${projectId}/progress`),
  })

  const updateStatus = useMutation({
    mutationFn: (status: string) => apiPut(`/modules/craftplanner/projects/${projectId}`, { status }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['craftplanner'] }),
  })

  const updateItemStatus = useMutation({
    mutationFn: ({ itemId, status }: { itemId: number; status: string }) =>
      apiPut(`/modules/craftplanner/items/${itemId}`, { status }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['craftplanner'] }),
  })

  const deleteItem = useMutation({
    mutationFn: (itemId: number) => apiDelete(`/modules/craftplanner/items/${itemId}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['craftplanner'] }),
  })

  if (isLoading || !project) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-surface rounded" />
          <div className="h-4 w-96 bg-surface rounded" />
        </div>
      </div>
    )
  }

  const buyItems = project.items.filter(i => i.item_type === 'buy')
  const makeItems = project.items.filter(i => i.item_type === 'make')

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="mb-6">
        <Link to="/projects" className="flex items-center gap-1 text-xs text-text-faint hover:text-text-muted mb-3">
          <ArrowLeft size={12} />
          Back to Projects
        </Link>
        <div className="flex items-center gap-3">
          <h1
            className="text-3xl"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
          >
            {project.name}
          </h1>
          <select
            value={project.status}
            onChange={e => updateStatus.mutate(e.target.value)}
            className="bg-surface border border-border rounded px-2 py-1 text-xs text-text"
          >
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {project.description && (
          <p className="text-sm text-text-muted mt-1">{project.description}</p>
        )}
      </div>

      {/* Progress cards */}
      {progress && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <div className="bg-surface border border-border rounded-lg p-3">
            <div className="flex items-center gap-2 text-xs text-text-muted mb-1">
              <Package size={12} />
              Items
            </div>
            <div className="text-lg font-semibold text-text">
              {progress.completed_items}/{progress.total_items}
            </div>
            <div className="text-[10px] text-text-faint">{progress.completion_pct}% complete</div>
          </div>
          <div className="bg-surface border border-border rounded-lg p-3">
            <div className="flex items-center gap-2 text-xs text-text-muted mb-1">
              <DollarSign size={12} />
              Cost
            </div>
            <div className="text-lg font-semibold text-text">
              ${progress.cost_spent.toLocaleString()}
            </div>
            <div className="text-[10px] text-text-faint">
              of ${progress.estimated_cost.toLocaleString()} estimated
            </div>
          </div>
          <div className="bg-surface border border-border rounded-lg p-3">
            <div className="flex items-center gap-2 text-xs text-text-muted mb-1">
              <Clock size={12} />
              Time
            </div>
            <div className="text-lg font-semibold text-text">
              {formatMinutes(progress.actual_time_minutes)}
            </div>
            <div className="text-[10px] text-text-faint">
              of {formatMinutes(progress.estimated_time_minutes)} estimated
            </div>
          </div>
          <div className="bg-surface border border-border rounded-lg p-3">
            <div className="flex items-center gap-2 text-xs text-text-muted mb-1">
              <DollarSign size={12} />
              Budget
            </div>
            <div className="text-lg font-semibold text-text">
              ${(project.budget ?? 0).toLocaleString()}
            </div>
            <div className="text-[10px] text-text-faint">
              {project.deadline ? `Due: ${project.deadline}` : 'No deadline'}
            </div>
          </div>
        </div>
      )}

      {/* Items */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-medium text-text">Items</h2>
        <button
          onClick={() => setShowAddItem(true)}
          className="flex items-center gap-1 text-xs text-accent hover:text-accent/80"
        >
          <Plus size={12} />
          Add Item
        </button>
      </div>

      {showAddItem && (
        <div className="mb-3">
          <AddItemForm projectId={projectId} onDone={() => setShowAddItem(false)} />
        </div>
      )}

      {/* Make items */}
      {makeItems.length > 0 && (
        <div className="mb-4">
          <div className="text-[10px] uppercase tracking-wider text-text-faint mb-2">Make</div>
          <div className="space-y-1">
            {makeItems.map(item => (
              <ItemRow
                key={item.id}
                item={item}
                onToggle={() => updateItemStatus.mutate({
                  itemId: item.id,
                  status: item.status === 'completed' ? 'pending' : 'completed',
                })}
                onLogTime={() => setLogTimeItem(item.id)}
                onDelete={() => deleteItem.mutate(item.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Buy items */}
      {buyItems.length > 0 && (
        <div className="mb-4">
          <div className="text-[10px] uppercase tracking-wider text-text-faint mb-2">Buy</div>
          <div className="space-y-1">
            {buyItems.map(item => (
              <ItemRow
                key={item.id}
                item={item}
                onToggle={() => updateItemStatus.mutate({
                  itemId: item.id,
                  status: item.status === 'completed' ? 'pending' : 'completed',
                })}
                onLogTime={() => setLogTimeItem(item.id)}
                onDelete={() => deleteItem.mutate(item.id)}
              />
            ))}
          </div>
        </div>
      )}

      {project.items.length === 0 && !showAddItem && (
        <div className="text-center py-8 bg-surface rounded-lg border border-border">
          <p className="text-sm text-text-muted">No items yet. Add items to track costs and time.</p>
        </div>
      )}

      {logTimeItem != null && (
        <LogTimeDialog itemId={logTimeItem} onClose={() => setLogTimeItem(null)} />
      )}
    </div>
  )
}

function ItemRow({ item, onToggle, onLogTime, onDelete }: {
  item: Item
  onToggle: () => void
  onLogTime: () => void
  onDelete: () => void
}) {
  const completed = item.status === 'completed'

  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-surface border border-border rounded group hover:border-accent/20 transition-colors">
      <button
        onClick={onToggle}
        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
          completed ? 'bg-success border-success text-bg' : 'border-border hover:border-accent'
        }`}
        aria-label={completed ? 'Mark incomplete' : 'Mark complete'}
      >
        {completed && <Check size={10} />}
      </button>
      <span className={`flex-1 text-sm ${completed ? 'line-through text-text-faint' : 'text-text'}`}>
        {item.name}
      </span>
      {item.estimated_cost != null && (
        <span className="text-[10px] text-text-faint">${item.estimated_cost}</span>
      )}
      {item.actual_time_minutes > 0 && (
        <span className="text-[10px] text-text-faint">{formatMinutes(item.actual_time_minutes)}</span>
      )}
      <button
        onClick={onLogTime}
        className="text-text-faint hover:text-accent opacity-0 group-hover:opacity-100 transition-all"
        title="Log time"
      >
        <Clock size={12} />
      </button>
      <button
        onClick={onDelete}
        className="text-text-faint hover:text-danger opacity-0 group-hover:opacity-100 transition-all"
        title="Delete"
      >
        <Trash2 size={12} />
      </button>
    </div>
  )
}
