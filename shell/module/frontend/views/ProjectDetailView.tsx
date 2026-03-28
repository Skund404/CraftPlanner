import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api'
import { Link, useParams, useNavigate } from '@tanstack/react-router'
import {
  ArrowLeft,
  Plus,
  Clock,
  DollarSign,
  Trash2,
  Check,
  Package,
  Pencil,
  Play,
  Pause,
  Archive,
  CheckCircle2,
  ShoppingCart,
  ListChecks,
  Star,
  CalendarDays,
  MapPin,
  Receipt,
  Tag as TagIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Tabs, TabContent } from '@/components/ui/Tabs'
import { Dialog } from '@/components/ui/Dialog'
import { Input, Textarea } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'

/* ---------- Types ---------- */

interface Project {
  id: number
  name: string
  description: string
  status: string
  budget: number | null
  deadline: string | null
  completion_pct: number
  tags: string[]
  primitive_path: string | null
  notes: string
  cover_image: string
  items: ProjectItem[]
  created_at: string
  updated_at: string
}

interface ProjectItem {
  id: number
  project_id: number
  name: string
  description: string
  item_type: 'buy' | 'make' | 'task'
  status: string
  estimated_cost: number | null
  actual_cost: number | null
  estimated_time_minutes: number | null
  actual_time_minutes: number
  quantity: number
  unit: string
  primitive_path: string | null
  sort_order: number
}

interface ProjectProgress {
  total_items: number
  completed_items: number
  completion_pct: number
  estimated_cost: number
  actual_cost: number
  cost_spent: number
  estimated_time_minutes: number
  actual_time_minutes: number
}

interface CostEntry {
  id: number
  project_id: number
  item_id: number | null
  category: string
  description: string
  amount: number
  currency: string
  is_estimate: number
  receipt_ref: string | null
  created_at: string
}

interface CostData {
  project_id: number
  entries: CostEntry[]
  total_estimated: number
  total_actual: number
}

interface TimeLog {
  id: number
  item_id: number
  project_id: number
  minutes: number
  note: string
  logged_at: string
  item_name?: string
}

interface CraftEvent {
  id: number
  project_id: number | null
  name: string
  description: string
  event_date: string | null
  location: string
  rating: number | null
  notes: string
  tags: string[]
  created_at: string
}

/* ---------- Helpers ---------- */

function formatTime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`
}

function statusLabel(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function statusVariant(status: string): 'warning' | 'accent' | 'muted' | 'success' | 'default' {
  switch (status) {
    case 'planning': return 'warning'
    case 'active': return 'accent'
    case 'paused': return 'muted'
    case 'completed': return 'success'
    case 'archived': return 'default'
    default: return 'default'
  }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/* ---------- Tab definitions ---------- */

const TABS = [
  { value: 'items', label: 'Items' },
  { value: 'tasks', label: 'Tasks' },
  { value: 'budget', label: 'Budget' },
  { value: 'timelog', label: 'Time Log' },
  { value: 'events', label: 'Events' },
  { value: 'notes', label: 'Notes' },
]

const ITEM_TYPE_OPTIONS = [
  { value: 'make', label: 'Make' },
  { value: 'buy', label: 'Buy' },
  { value: 'task', label: 'Task' },
]

/* ---------- Sub-components ---------- */

function ItemRow({
  item,
  onToggle,
  onDelete,
}: {
  item: ProjectItem
  onToggle: () => void
  onDelete: () => void
}) {
  const completed = item.status === 'completed'

  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-surface border border-border rounded group hover:border-accent/20 transition-colors">
      <button
        onClick={onToggle}
        className={cn(
          'w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors',
          completed
            ? 'bg-success border-success text-bg'
            : 'border-border hover:border-accent',
        )}
        aria-label={completed ? 'Mark incomplete' : 'Mark complete'}
      >
        {completed && <Check size={10} />}
      </button>
      <div className="flex-1 min-w-0">
        <span className={cn('text-sm', completed ? 'line-through text-text-faint' : 'text-text')}>
          {item.name}
        </span>
        {item.description && (
          <p className="text-xs text-text-faint line-clamp-1 mt-0.5">{item.description}</p>
        )}
      </div>
      {item.quantity > 1 && (
        <span className="text-[10px] text-text-faint">
          {item.quantity}{item.unit ? ` ${item.unit}` : ''}
        </span>
      )}
      {item.estimated_cost != null && (
        <span className="text-[10px] text-text-faint">{formatCurrency(item.estimated_cost)}</span>
      )}
      {item.actual_time_minutes > 0 && (
        <span className="text-[10px] text-text-faint">{formatTime(item.actual_time_minutes)}</span>
      )}
      <button
        onClick={onDelete}
        className="text-text-faint hover:text-danger opacity-0 group-hover:opacity-100 transition-all p-0.5"
        title="Delete item"
      >
        <Trash2 size={12} />
      </button>
    </div>
  )
}

function ProgressCard({
  icon,
  label,
  value,
  subtext,
  pct,
  warn,
}: {
  icon: React.ReactNode
  label: string
  value: string
  subtext: string
  pct?: number
  warn?: boolean
}) {
  return (
    <div className="flex-1 rounded-lg border border-border bg-surface p-3">
      <div className="flex items-center gap-1.5 text-xs text-text-muted mb-1">
        {icon}
        {label}
      </div>
      <div className="text-lg font-semibold text-text">{value}</div>
      {pct != null && (
        <div className="h-1.5 rounded-full bg-surface-el mt-2 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              warn ? 'bg-warning' : 'bg-accent',
            )}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
      )}
      <div className="text-[10px] text-text-faint mt-1">{subtext}</div>
    </div>
  )
}

/* ---------- Add Item Dialog ---------- */

function AddItemDialog({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: number
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [itemType, setItemType] = useState('make')
  const [description, setDescription] = useState('')
  const [estimatedCost, setEstimatedCost] = useState('')
  const [estimatedTime, setEstimatedTime] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unit, setUnit] = useState('')

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiPost('/modules/craftplanner/items', data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      void queryClient.invalidateQueries({ queryKey: ['project-progress', projectId] })
      resetForm()
      onOpenChange(false)
    },
  })

  function resetForm() {
    setName('')
    setItemType('make')
    setDescription('')
    setEstimatedCost('')
    setEstimatedTime('')
    setQuantity('1')
    setUnit('')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    mutation.mutate({
      project_id: projectId,
      name: name.trim(),
      item_type: itemType,
      description: description.trim(),
      estimated_cost: estimatedCost ? parseFloat(estimatedCost) : null,
      estimated_time_minutes: estimatedTime ? parseInt(estimatedTime) : null,
      quantity: quantity ? parseInt(quantity) : 1,
      unit: unit.trim(),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Add Item">
      <form onSubmit={handleSubmit} className="space-y-3">
        <Input
          label="Name"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Item name"
          required
          autoFocus
        />
        <Select
          label="Type"
          value={itemType}
          onValueChange={setItemType}
          options={ITEM_TYPE_OPTIONS}
        />
        <Textarea
          label="Description"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Optional description"
          rows={2}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Estimated Cost"
            type="number"
            step="0.01"
            min="0"
            value={estimatedCost}
            onChange={e => setEstimatedCost(e.target.value)}
            placeholder="0.00"
          />
          <Input
            label="Estimated Time (min)"
            type="number"
            min="0"
            value={estimatedTime}
            onChange={e => setEstimatedTime(e.target.value)}
            placeholder="0"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Quantity"
            type="number"
            min="1"
            value={quantity}
            onChange={e => setQuantity(e.target.value)}
          />
          <Input
            label="Unit"
            value={unit}
            onChange={e => setUnit(e.target.value)}
            placeholder="pcs, yards, etc."
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" disabled={!name.trim() || mutation.isPending}>
            {mutation.isPending ? 'Adding...' : 'Add Item'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

/* ---------- Edit Project Dialog ---------- */

function EditProjectDialog({
  project,
  open,
  onOpenChange,
}: {
  project: Project
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [name, setName] = useState(project.name)
  const [description, setDescription] = useState(project.description)
  const [budget, setBudget] = useState(project.budget != null ? String(project.budget) : '')
  const [deadline, setDeadline] = useState(project.deadline ?? '')
  const [tags, setTags] = useState(project.tags.join(', '))
  const [notes, setNotes] = useState(project.notes ?? '')

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiPut(`/modules/craftplanner/projects/${project.id}`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['project', project.id] })
      onOpenChange(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => apiDelete(`/modules/craftplanner/projects/${project.id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['project', project.id] })
      navigate({ to: '/projects' })
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    updateMutation.mutate({
      name: name.trim(),
      description: description.trim(),
      budget: budget ? parseFloat(budget) : null,
      deadline: deadline || null,
      tags: tags
        .split(',')
        .map(t => t.trim())
        .filter(Boolean),
      notes: notes.trim(),
    })
  }

  function handleDelete() {
    if (confirm(`Delete "${project.name}"? This cannot be undone.`)) {
      deleteMutation.mutate()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Edit Project">
      <form onSubmit={handleSubmit} className="space-y-3">
        <Input
          label="Name"
          value={name}
          onChange={e => setName(e.target.value)}
          required
          autoFocus
        />
        <Textarea
          label="Description"
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={2}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Budget"
            type="number"
            step="0.01"
            min="0"
            value={budget}
            onChange={e => setBudget(e.target.value)}
            placeholder="0.00"
          />
          <Input
            label="Deadline"
            type="date"
            value={deadline}
            onChange={e => setDeadline(e.target.value)}
          />
        </div>
        <Input
          label="Tags (comma-separated)"
          value={tags}
          onChange={e => setTags(e.target.value)}
          placeholder="cosplay, armor, wip"
        />
        <Textarea
          label="Notes"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
        />
        <div className="flex items-center justify-between pt-2">
          <Button type="button" variant="danger" size="sm" onClick={handleDelete}>
            <Trash2 size={12} />
            Delete Project
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={!name.trim() || updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </form>
    </Dialog>
  )
}

/* ---------- Tab: Items ---------- */

function ItemsTab({
  items,
  onToggleItem,
  onDeleteItem,
}: {
  items: ProjectItem[]
  onToggleItem: (id: number, currentStatus: string) => void
  onDeleteItem: (id: number) => void
}) {
  const makeItems = items
    .filter(i => i.item_type === 'make')
    .sort((a, b) => a.sort_order - b.sort_order)
  const buyItems = items
    .filter(i => i.item_type === 'buy')
    .sort((a, b) => a.sort_order - b.sort_order)

  if (items.filter(i => i.item_type !== 'task').length === 0) {
    return (
      <div className="text-center py-10">
        <Package size={24} className="mx-auto text-text-faint mb-2" />
        <p className="text-sm text-text-muted">No items yet.</p>
        <p className="text-xs text-text-faint mt-1">
          Add items to track what you need to make or buy.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5 py-4">
      {makeItems.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-text-faint mb-2 px-1">
            Make
          </div>
          <div className="space-y-1">
            {makeItems.map(item => (
              <ItemRow
                key={item.id}
                item={item}
                onToggle={() => onToggleItem(item.id, item.status)}
                onDelete={() => onDeleteItem(item.id)}
              />
            ))}
          </div>
        </div>
      )}
      {buyItems.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-text-faint mb-2 px-1">
            Buy
          </div>
          <div className="space-y-1">
            {buyItems.map(item => (
              <ItemRow
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

/* ---------- Tab: Tasks ---------- */

function TasksTab({
  items,
  onToggleItem,
  onDeleteItem,
}: {
  items: ProjectItem[]
  onToggleItem: (id: number, currentStatus: string) => void
  onDeleteItem: (id: number) => void
}) {
  const tasks = items
    .filter(i => i.item_type === 'task')
    .sort((a, b) => a.sort_order - b.sort_order)

  if (tasks.length === 0) {
    return (
      <div className="text-center py-10">
        <ListChecks size={24} className="mx-auto text-text-faint mb-2" />
        <p className="text-sm text-text-muted">No tasks yet.</p>
        <p className="text-xs text-text-faint mt-1">
          Add tasks to track your to-do list for this project.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-1 py-4">
      {tasks.map(item => (
        <ItemRow
          key={item.id}
          item={item}
          onToggle={() => onToggleItem(item.id, item.status)}
          onDelete={() => onDeleteItem(item.id)}
        />
      ))}
    </div>
  )
}

/* ---------- Tab: Notes ---------- */

function NotesTab({ projectId, notes }: { projectId: number; notes: string }) {
  const queryClient = useQueryClient()
  const [value, setValue] = useState(notes ?? '')
  const [saved, setSaved] = useState(true)

  const mutation = useMutation({
    mutationFn: (data: { notes: string }) =>
      apiPut(`/modules/craftplanner/projects/${projectId}`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      setSaved(true)
    },
  })

  return (
    <div className="py-4 space-y-3">
      <textarea
        value={value}
        onChange={e => {
          setValue(e.target.value)
          setSaved(false)
        }}
        placeholder="Write project notes here..."
        className={cn(
          'w-full min-h-[200px] px-3 py-2 rounded border bg-surface-el text-text text-sm',
          'border-border-bright placeholder:text-text-faint',
          'focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25',
          'transition-colors resize-y',
        )}
        rows={8}
      />
      <div className="flex items-center gap-3">
        <Button
          variant="primary"
          size="sm"
          onClick={() => mutation.mutate({ notes: value })}
          disabled={saved || mutation.isPending}
        >
          {mutation.isPending ? 'Saving...' : 'Save Notes'}
        </Button>
        {saved && !mutation.isPending && (
          <span className="text-xs text-text-faint">All changes saved</span>
        )}
      </div>
    </div>
  )
}

/* ---------- Tab: Budget ---------- */

function AddCostDialog({
  projectId,
  open,
  onOpenChange,
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

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiPost('/modules/craftplanner/costs', data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['project-costs', projectId] })
      void queryClient.invalidateQueries({ queryKey: ['project', projectId] })
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
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Add Cost">
      <form onSubmit={handleSubmit} className="space-y-3">
        <Select
          label="Category"
          value={category}
          onValueChange={setCategory}
          options={[
            { value: 'materials', label: 'Materials' },
            { value: 'tools', label: 'Tools' },
            { value: 'services', label: 'Services' },
            { value: 'shipping', label: 'Shipping' },
            { value: 'other', label: 'Other' },
          ]}
        />
        <Input
          label="Description"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="What was this cost for?"
          required
          autoFocus
        />
        <Input
          label="Amount"
          type="number"
          step="0.01"
          min="0"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder="0.00"
          required
        />
        <label className="flex items-center gap-2 text-sm text-text-muted cursor-pointer">
          <input
            type="checkbox"
            checked={isEstimate}
            onChange={e => setIsEstimate(e.target.checked)}
            className="rounded border-border"
          />
          This is an estimate
        </label>
        <Input
          label="Receipt Reference (optional)"
          value={receiptRef}
          onChange={e => setReceiptRef(e.target.value)}
          placeholder="Receipt # or link"
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" disabled={!description.trim() || !amount || mutation.isPending}>
            {mutation.isPending ? 'Adding...' : 'Add Cost'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

function BudgetTab({ projectId, budget }: { projectId: number; budget: number | null }) {
  const [showAddCost, setShowAddCost] = useState(false)

  const { data: costData, isLoading } = useQuery({
    queryKey: ['project-costs', projectId],
    queryFn: () => apiGet<CostData>('/modules/craftplanner/costs/' + projectId),
  })

  if (isLoading) {
    return (
      <div className="py-10 text-center text-sm text-text-faint">Loading budget data...</div>
    )
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
  const maxCategoryTotal = Math.max(...Object.values(categoryTotals), 1)

  // Sort entries by date desc
  const sortedEntries = [...entries].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )

  return (
    <div className="py-4 space-y-6">
      {/* Budget summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border border-border bg-surface p-3">
          <div className="text-[10px] uppercase tracking-wider text-text-faint mb-1">Budget</div>
          <div className="text-lg font-semibold text-text">
            {budget != null ? formatCurrency(budget) : '—'}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-3">
          <div className="text-[10px] uppercase tracking-wider text-text-faint mb-1">Estimated</div>
          <div className="text-lg font-semibold text-text">{formatCurrency(totalEstimated)}</div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-3">
          <div className="text-[10px] uppercase tracking-wider text-text-faint mb-1">Actual</div>
          <div className="text-lg font-semibold text-text">{formatCurrency(totalActual)}</div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-3">
          <div className="text-[10px] uppercase tracking-wider text-text-faint mb-1">Remaining</div>
          <div className={cn('text-lg font-semibold', remaining < 0 ? 'text-danger' : 'text-success')}>
            {budget != null ? formatCurrency(remaining) : '—'}
          </div>
        </div>
      </div>

      {/* Category breakdown */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-text-faint mb-2 px-1">
          By Category
        </div>
        <div className="space-y-2">
          {categories.map(cat => {
            const total = categoryTotals[cat]
            if (total === 0) return null
            const pct = (total / maxCategoryTotal) * 100
            return (
              <div key={cat} className="flex items-center gap-3">
                <span className="text-xs text-text-muted w-20 capitalize">{cat}</span>
                <div className="flex-1 h-2 rounded-full bg-surface-el overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs text-text-muted w-16 text-right">{formatCurrency(total)}</span>
              </div>
            )
          })}
          {Object.values(categoryTotals).every(v => v === 0) && (
            <div className="text-xs text-text-faint text-center py-2">No costs recorded yet</div>
          )}
        </div>
      </div>

      {/* Cost entries list */}
      <div>
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="text-[10px] uppercase tracking-wider text-text-faint">
            Cost Entries
          </div>
          <Button variant="secondary" size="sm" onClick={() => setShowAddCost(true)}>
            <Plus size={12} />
            Add Cost
          </Button>
        </div>
        {sortedEntries.length === 0 ? (
          <div className="text-center py-8">
            <Receipt size={24} className="mx-auto text-text-faint mb-2" />
            <p className="text-sm text-text-muted">No cost entries yet.</p>
            <p className="text-xs text-text-faint mt-1">Track your project spending here.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {sortedEntries.map(entry => (
              <div
                key={entry.id}
                className="flex items-center gap-3 px-3 py-2 bg-surface border border-border rounded"
              >
                <Badge variant="default" className="text-[10px] capitalize">
                  {entry.category}
                </Badge>
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-text">{entry.description}</span>
                  {entry.receipt_ref && (
                    <span className="text-[10px] text-text-faint ml-2">#{entry.receipt_ref}</span>
                  )}
                </div>
                {entry.is_estimate === 1 && (
                  <Badge variant="warning" className="text-[10px]">est.</Badge>
                )}
                <span className="text-sm font-medium text-text">{formatCurrency(entry.amount)}</span>
                <span className="text-[10px] text-text-faint">{formatDate(entry.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <AddCostDialog projectId={projectId} open={showAddCost} onOpenChange={setShowAddCost} />
    </div>
  )
}

/* ---------- Tab: Time Log ---------- */

function LogTimeDialog({
  projectId,
  items,
  open,
  onOpenChange,
}: {
  projectId: number
  items: ProjectItem[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [itemId, setItemId] = useState('')
  const [minutes, setMinutes] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: (data: { itemId: number; minutes: number; note: string }) =>
      apiPost(`/modules/craftplanner/items/${data.itemId}/log-time`, {
        minutes: data.minutes,
        note: data.note,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['project-time-logs', projectId] })
      void queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      void queryClient.invalidateQueries({ queryKey: ['project-progress', projectId] })
      resetForm()
      onOpenChange(false)
    },
  })

  function resetForm() {
    setItemId('')
    setMinutes('')
    setNote('')
    setError('')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!itemId) {
      setError('Please select an item to log time against.')
      return
    }
    if (!minutes || parseInt(minutes) <= 0) return
    setError('')
    mutation.mutate({
      itemId: parseInt(itemId),
      minutes: parseInt(minutes),
      note: note.trim(),
    })
  }

  const itemOptions = items.map(i => ({ value: String(i.id), label: i.name }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Log Time">
      <form onSubmit={handleSubmit} className="space-y-3">
        <Select
          label="Item"
          value={itemId}
          onValueChange={v => { setItemId(v); setError('') }}
          options={[{ value: '', label: 'Select an item...' }, ...itemOptions]}
        />
        {error && <p className="text-xs text-danger">{error}</p>}
        <Input
          label="Minutes"
          type="number"
          min="1"
          value={minutes}
          onChange={e => setMinutes(e.target.value)}
          placeholder="30"
          required
          autoFocus
        />
        <Textarea
          label="Note"
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="What did you work on?"
          rows={2}
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" disabled={mutation.isPending}>
            {mutation.isPending ? 'Logging...' : 'Log Time'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

function TimeLogTab({ projectId, items }: { projectId: number; items: ProjectItem[] }) {
  const [showLogTime, setShowLogTime] = useState(false)

  const { data: timeLogs, isLoading } = useQuery({
    queryKey: ['project-time-logs', projectId],
    queryFn: () => apiGet<TimeLog[]>('/modules/craftplanner/time-logs', { project_id: String(projectId) }),
  })

  if (isLoading) {
    return (
      <div className="py-10 text-center text-sm text-text-faint">Loading time logs...</div>
    )
  }

  const logs = timeLogs ?? []
  const totalMinutes = logs.reduce((sum, l) => sum + l.minutes, 0)

  // This week's time
  const now = new Date()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay())
  startOfWeek.setHours(0, 0, 0, 0)
  const weekMinutes = logs
    .filter(l => new Date(l.logged_at) >= startOfWeek)
    .reduce((sum, l) => sum + l.minutes, 0)

  // Per-item breakdown
  const itemTotals: Record<number, { name: string; minutes: number }> = {}
  for (const log of logs) {
    if (!itemTotals[log.item_id]) {
      itemTotals[log.item_id] = { name: log.item_name ?? `Item #${log.item_id}`, minutes: 0 }
    }
    itemTotals[log.item_id].minutes += log.minutes
  }
  const itemBreakdown = Object.values(itemTotals).sort((a, b) => b.minutes - a.minutes)
  const maxItemMinutes = Math.max(...itemBreakdown.map(i => i.minutes), 1)

  // Group by day
  const dayGroups: Record<string, TimeLog[]> = {}
  for (const log of [...logs].sort((a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime())) {
    const day = new Date(log.logged_at).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
    if (!dayGroups[day]) dayGroups[day] = []
    dayGroups[day].push(log)
  }

  return (
    <div className="py-4 space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-surface p-3">
          <div className="text-[10px] uppercase tracking-wider text-text-faint mb-1">Total Time</div>
          <div className="text-lg font-semibold text-text">{formatTime(totalMinutes)}</div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-3">
          <div className="text-[10px] uppercase tracking-wider text-text-faint mb-1">This Week</div>
          <div className="text-lg font-semibold text-text">{formatTime(weekMinutes)}</div>
        </div>
      </div>

      {/* Per-item breakdown */}
      {itemBreakdown.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-text-faint mb-2 px-1">
            By Item
          </div>
          <div className="space-y-2">
            {itemBreakdown.map(item => {
              const pct = (item.minutes / maxItemMinutes) * 100
              return (
                <div key={item.name} className="flex items-center gap-3">
                  <span className="text-xs text-text-muted w-32 truncate">{item.name}</span>
                  <div className="flex-1 h-2 rounded-full bg-surface-el overflow-hidden">
                    <div
                      className="h-full rounded-full bg-accent transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-text-muted w-16 text-right">{formatTime(item.minutes)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Timeline grouped by day */}
      <div>
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="text-[10px] uppercase tracking-wider text-text-faint">
            Timeline
          </div>
          <Button variant="secondary" size="sm" onClick={() => setShowLogTime(true)}>
            <Plus size={12} />
            Log Time
          </Button>
        </div>
        {logs.length === 0 ? (
          <div className="text-center py-8">
            <Clock size={24} className="mx-auto text-text-faint mb-2" />
            <p className="text-sm text-text-muted">No time logged yet.</p>
            <p className="text-xs text-text-faint mt-1">Track how long you spend on each item.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(dayGroups).map(([day, dayLogs]) => (
              <div key={day}>
                <div className="text-xs font-medium text-text-muted mb-1 px-1">{day}</div>
                <div className="space-y-1">
                  {dayLogs.map(log => (
                    <div
                      key={log.id}
                      className="flex items-center gap-3 px-3 py-2 bg-surface border border-border rounded"
                    >
                      <Clock size={12} className="text-text-faint shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-text">{log.item_name ?? `Item #${log.item_id}`}</span>
                        {log.note && (
                          <p className="text-xs text-text-faint line-clamp-1 mt-0.5">{log.note}</p>
                        )}
                      </div>
                      <span className="text-sm font-medium text-text">{formatTime(log.minutes)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <LogTimeDialog
        projectId={projectId}
        items={items}
        open={showLogTime}
        onOpenChange={setShowLogTime}
      />
    </div>
  )
}

/* ---------- Tab: Events ---------- */

function LinkEventDialog({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: number
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiPost('/modules/craftplanner/events', data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['project-events', projectId] })
      resetForm()
      onOpenChange(false)
    },
  })

  function resetForm() {
    setName('')
    setDescription('')
    setEventDate('')
    setLocation('')
    setNotes('')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    mutation.mutate({
      project_id: projectId,
      name: name.trim(),
      description: description.trim(),
      event_date: eventDate || null,
      location: location.trim(),
      notes: notes.trim(),
      tags: [],
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Link Event">
      <form onSubmit={handleSubmit} className="space-y-3">
        <Input
          label="Event Name"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Convention, meetup, photoshoot..."
          required
          autoFocus
        />
        <Textarea
          label="Description"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Optional description"
          rows={2}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Date"
            type="date"
            value={eventDate}
            onChange={e => setEventDate(e.target.value)}
          />
          <Input
            label="Location"
            value={location}
            onChange={e => setLocation(e.target.value)}
            placeholder="City, venue..."
          />
        </div>
        <Textarea
          label="Notes"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Any additional notes"
          rows={2}
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" disabled={!name.trim() || mutation.isPending}>
            {mutation.isPending ? 'Creating...' : 'Create Event'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

function ProjectEventsTab({ projectId }: { projectId: number }) {
  const [showLinkEvent, setShowLinkEvent] = useState(false)

  const { data: events, isLoading } = useQuery({
    queryKey: ['project-events', projectId],
    queryFn: () => apiGet<CraftEvent[]>('/modules/craftplanner/events', { project_id: String(projectId) }),
  })

  if (isLoading) {
    return (
      <div className="py-10 text-center text-sm text-text-faint">Loading events...</div>
    )
  }

  const eventList = events ?? []

  function renderStars(rating: number | null) {
    if (rating == null) return null
    const stars = []
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Star
          key={i}
          size={12}
          className={i <= rating ? 'text-warning fill-warning' : 'text-text-faint'}
        />,
      )
    }
    return <div className="flex items-center gap-0.5">{stars}</div>
  }

  return (
    <div className="py-4 space-y-4">
      <div className="flex items-center justify-between px-1">
        <div className="text-[10px] uppercase tracking-wider text-text-faint">
          Events ({eventList.length})
        </div>
        <Button variant="secondary" size="sm" onClick={() => setShowLinkEvent(true)}>
          <Plus size={12} />
          Link Event
        </Button>
      </div>

      {eventList.length === 0 ? (
        <div className="text-center py-8">
          <CalendarDays size={24} className="mx-auto text-text-faint mb-2" />
          <p className="text-sm text-text-muted">No events linked yet.</p>
          <p className="text-xs text-text-faint mt-1">
            Link events where this project will be used or shown.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {eventList.map(event => (
            <div
              key={event.id}
              className="rounded-lg border border-border bg-surface p-4 space-y-2"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-medium text-text">{event.name}</h3>
                  {event.description && (
                    <p className="text-xs text-text-muted mt-0.5">{event.description}</p>
                  )}
                </div>
                {renderStars(event.rating)}
              </div>
              <div className="flex items-center gap-4 text-xs text-text-faint flex-wrap">
                {event.event_date && (
                  <span className="flex items-center gap-1">
                    <CalendarDays size={10} />
                    {formatDate(event.event_date)}
                  </span>
                )}
                {event.location && (
                  <span className="flex items-center gap-1">
                    <MapPin size={10} />
                    {event.location}
                  </span>
                )}
                {event.tags.length > 0 && (
                  <span className="flex items-center gap-1">
                    <TagIcon size={10} />
                    {event.tags.join(', ')}
                  </span>
                )}
              </div>
              {event.notes && (
                <p className="text-xs text-text-muted">{event.notes}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <LinkEventDialog
        projectId={projectId}
        open={showLinkEvent}
        onOpenChange={setShowLinkEvent}
      />
    </div>
  )
}

/* ---------- Status Action Buttons ---------- */

function StatusActions({
  status,
  onChangeStatus,
  isPending,
}: {
  status: string
  onChangeStatus: (newStatus: string) => void
  isPending: boolean
}) {
  switch (status) {
    case 'planning':
      return (
        <Button variant="primary" size="sm" onClick={() => onChangeStatus('active')} disabled={isPending}>
          <Play size={12} />
          Start Project
        </Button>
      )
    case 'active':
      return (
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => onChangeStatus('paused')} disabled={isPending}>
            <Pause size={12} />
            Pause
          </Button>
          <Button variant="primary" size="sm" onClick={() => onChangeStatus('completed')} disabled={isPending}>
            <CheckCircle2 size={12} />
            Complete
          </Button>
        </div>
      )
    case 'paused':
      return (
        <Button variant="primary" size="sm" onClick={() => onChangeStatus('active')} disabled={isPending}>
          <Play size={12} />
          Resume
        </Button>
      )
    case 'completed':
      return (
        <Button variant="ghost" size="sm" onClick={() => onChangeStatus('archived')} disabled={isPending}>
          <Archive size={12} />
          Archive
        </Button>
      )
    default:
      return null
  }
}

/* ========== Main Component ========== */

export function ProjectDetailView({ id }: { id: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const projectId = parseInt(id)

  // Try to get tab from params; fallback to 'items'
  const params = useParams({ strict: false }) as Record<string, string | undefined>
  const currentTab = params.tab ?? 'items'

  // Dialog state
  const [showAddItem, setShowAddItem] = useState(false)
  const [showEditProject, setShowEditProject] = useState(false)
  const [showLogTime, setShowLogTime] = useState(false)
  const [showAddCost, setShowAddCost] = useState(false)
  const [showLinkEvent, setShowLinkEvent] = useState(false)

  /* ---------- Queries ---------- */

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => apiGet<Project>(`/modules/craftplanner/projects/${projectId}`),
  })

  const { data: progress } = useQuery({
    queryKey: ['project-progress', projectId],
    queryFn: () => apiGet<ProjectProgress>(`/modules/craftplanner/projects/${projectId}/progress`),
  })

  /* ---------- Mutations ---------- */

  const updateStatus = useMutation({
    mutationFn: (status: string) =>
      apiPut(`/modules/craftplanner/projects/${projectId}`, { status }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      void queryClient.invalidateQueries({ queryKey: ['project-progress', projectId] })
    },
  })

  const toggleItem = useMutation({
    mutationFn: ({ itemId, status }: { itemId: number; status: string }) =>
      apiPut(`/modules/craftplanner/items/${itemId}`, { status }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      void queryClient.invalidateQueries({ queryKey: ['project-progress', projectId] })
    },
  })

  const deleteItem = useMutation({
    mutationFn: (itemId: number) => apiDelete(`/modules/craftplanner/items/${itemId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      void queryClient.invalidateQueries({ queryKey: ['project-progress', projectId] })
    },
  })

  /* ---------- Handlers ---------- */

  function handleToggleItem(itemId: number, currentStatus: string) {
    toggleItem.mutate({
      itemId,
      status: currentStatus === 'completed' ? 'pending' : 'completed',
    })
  }

  function handleDeleteItem(itemId: number) {
    deleteItem.mutate(itemId)
  }

  function handleTabChange(tab: string) {
    navigate({ to: `/projects/${id}/${tab}` as never })
  }

  /* ---------- Loading / Error ---------- */

  if (isLoading || !project) {
    return (
      <div className="max-w-5xl mx-auto px-6 pt-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-24 bg-surface rounded" />
          <div className="h-8 w-64 bg-surface rounded" />
          <div className="h-4 w-96 bg-surface rounded" />
          <div className="flex gap-3 mt-6">
            <div className="flex-1 h-20 bg-surface rounded-lg" />
            <div className="flex-1 h-20 bg-surface rounded-lg" />
            <div className="flex-1 h-20 bg-surface rounded-lg" />
          </div>
        </div>
      </div>
    )
  }

  /* ---------- Derived data ---------- */

  const costPct =
    progress && progress.estimated_cost > 0
      ? Math.round((progress.cost_spent / progress.estimated_cost) * 100)
      : 0
  const costWarn = costPct > 90

  const itemsPct = progress ? progress.completion_pct : project.completion_pct

  /* ---------- Render ---------- */

  return (
    <div className="max-w-5xl mx-auto flex flex-col min-h-full">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        {/* Top bar: back link + actions */}
        <div className="flex items-center justify-between mb-4">
          <Link
            to="/projects"
            className="flex items-center gap-1.5 text-xs text-text-faint hover:text-text-muted transition-colors"
          >
            <ArrowLeft size={12} />
            Projects
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setShowEditProject(true)}>
              <Pencil size={12} />
              Edit
            </Button>
            <StatusActions
              status={project.status}
              onChangeStatus={s => updateStatus.mutate(s)}
              isPending={updateStatus.isPending}
            />
          </div>
        </div>

        {/* Project name + description */}
        <div className="mb-1 flex items-center gap-3">
          <h1
            className="text-2xl text-text"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
          >
            {project.name}
          </h1>
          <Badge variant={statusVariant(project.status)}>{statusLabel(project.status)}</Badge>
        </div>
        {project.description && (
          <p className="text-sm text-text-muted line-clamp-2 mb-2">{project.description}</p>
        )}
        <div className="flex items-center gap-3 text-xs text-text-faint flex-wrap">
          {project.created_at && (
            <span>Started: {formatDate(project.created_at)}</span>
          )}
          {project.deadline && (
            <span>Due: {formatDate(project.deadline)}</span>
          )}
          {project.tags.length > 0 && (
            <div className="flex items-center gap-1.5">
              {project.tags.map(tag => (
                <Badge key={tag} variant="default" className="text-[10px] py-0">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Progress strip */}
        {progress && (
          <div className="flex gap-3 mt-4">
            <ProgressCard
              icon={<Package size={12} />}
              label="Items"
              value={`${progress.completed_items}/${progress.total_items}`}
              subtext={`${Math.round(itemsPct)}% complete`}
              pct={itemsPct}
            />
            <ProgressCard
              icon={<DollarSign size={12} />}
              label="Cost"
              value={`${formatCurrency(progress.cost_spent)}/${project.budget != null ? formatCurrency(project.budget) : formatCurrency(progress.estimated_cost)}`}
              subtext={
                project.budget != null
                  ? `Budget: ${formatCurrency(project.budget)}`
                  : `Estimated: ${formatCurrency(progress.estimated_cost)}`
              }
              pct={
                project.budget != null && project.budget > 0
                  ? Math.round((progress.cost_spent / project.budget) * 100)
                  : costPct
              }
              warn={costWarn}
            />
            <ProgressCard
              icon={<Clock size={12} />}
              label="Time"
              value={formatTime(progress.actual_time_minutes)}
              subtext={
                progress.estimated_time_minutes > 0
                  ? `of ${formatTime(progress.estimated_time_minutes)} estimated`
                  : 'logged'
              }
              pct={
                progress.estimated_time_minutes > 0
                  ? Math.round(
                      (progress.actual_time_minutes / progress.estimated_time_minutes) * 100,
                    )
                  : undefined
              }
            />
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex-1 flex flex-col min-h-0 px-6">
        <Tabs tabs={TABS} value={currentTab} onValueChange={handleTabChange}>
          <TabContent value="items" className="flex-1 overflow-y-auto focus:outline-none">
            <ItemsTab
              items={project.items}
              onToggleItem={handleToggleItem}
              onDeleteItem={handleDeleteItem}
            />
          </TabContent>
          <TabContent value="tasks" className="flex-1 overflow-y-auto focus:outline-none">
            <TasksTab
              items={project.items}
              onToggleItem={handleToggleItem}
              onDeleteItem={handleDeleteItem}
            />
          </TabContent>
          <TabContent value="budget" className="flex-1 overflow-y-auto focus:outline-none">
            <BudgetTab projectId={projectId} budget={project.budget} />
          </TabContent>
          <TabContent value="timelog" className="flex-1 overflow-y-auto focus:outline-none">
            <TimeLogTab projectId={projectId} items={project.items} />
          </TabContent>
          <TabContent value="events" className="flex-1 overflow-y-auto focus:outline-none">
            <ProjectEventsTab projectId={projectId} />
          </TabContent>
          <TabContent value="notes" className="flex-1 overflow-y-auto focus:outline-none">
            <NotesTab projectId={projectId} notes={project.notes ?? ''} />
          </TabContent>
        </Tabs>
      </div>

      {/* Bottom action bar */}
      <div className="sticky bottom-0 border-t border-border bg-bg/90 backdrop-blur px-4 py-2.5 flex items-center gap-2">
        <Button variant="primary" size="sm" onClick={() => setShowAddItem(true)}>
          <Plus size={12} />
          Add Item
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setShowLogTime(true)}>
          <Clock size={12} />
          Log Time
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setShowAddCost(true)}>
          <DollarSign size={12} />
          Add Cost
        </Button>
        <div className="flex-1" />
        <Link
          to={`/shopping-list?project=${projectId}` as never}
          className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-accent transition-colors"
        >
          <ShoppingCart size={12} />
          Shopping List
        </Link>
      </div>

      {/* Dialogs */}
      <AddItemDialog
        projectId={projectId}
        open={showAddItem}
        onOpenChange={setShowAddItem}
      />
      {showEditProject && (
        <EditProjectDialog
          project={project}
          open={showEditProject}
          onOpenChange={setShowEditProject}
        />
      )}
      <LogTimeDialog
        projectId={projectId}
        items={project.items}
        open={showLogTime}
        onOpenChange={setShowLogTime}
      />
      <AddCostDialog
        projectId={projectId}
        open={showAddCost}
        onOpenChange={setShowAddCost}
      />
      <LinkEventDialog
        projectId={projectId}
        open={showLinkEvent}
        onOpenChange={setShowLinkEvent}
      />
    </div>
  )
}
