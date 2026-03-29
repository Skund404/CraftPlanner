import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost, apiDelete } from '@/lib/api'
import { Link, useNavigate } from '@tanstack/react-router'
import { Plus, Search, Trash2, ChevronDown, FolderKanban, Clock, DollarSign, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
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
  created_at: string
  updated_at: string
}

/* ---------- Constants ---------- */

const STATUS_BADGE_VARIANT: Record<string, 'default' | 'accent' | 'success' | 'warning' | 'danger' | 'muted'> = {
  planning: 'muted',
  active: 'accent',
  paused: 'warning',
  completed: 'success',
  archived: 'default',
}

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'planning', label: 'Planning' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' },
]

const SORT_OPTIONS = [
  { value: 'updated', label: 'Last updated' },
  { value: 'name', label: 'Name' },
  { value: 'created', label: 'Created' },
  { value: 'deadline', label: 'Deadline' },
  { value: 'budget', label: 'Budget' },
  { value: 'completion', label: 'Completion %' },
]

/* ---------- Helpers ---------- */

function formatCurrency(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function daysUntil(dateStr: string): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const target = new Date(dateStr)
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

function relativeDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const diffWeeks = Math.floor(diffDays / 7)

  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffWeeks === 1) return '1w ago'
  if (diffWeeks < 5) return `${diffWeeks}w ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function sortProjects(projects: Project[], sortBy: string): Project[] {
  const sorted = [...projects]
  switch (sortBy) {
    case 'name':
      return sorted.sort((a, b) => a.name.localeCompare(b.name))
    case 'created':
      return sorted.sort((a, b) => b.created_at.localeCompare(a.created_at))
    case 'updated':
      return sorted.sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    case 'deadline':
      return sorted.sort((a, b) => {
        if (!a.deadline && !b.deadline) return 0
        if (!a.deadline) return 1
        if (!b.deadline) return -1
        return a.deadline.localeCompare(b.deadline)
      })
    case 'budget':
      return sorted.sort((a, b) => (b.budget ?? 0) - (a.budget ?? 0))
    case 'completion':
      return sorted.sort((a, b) => b.completion_pct - a.completion_pct)
    default:
      return sorted
  }
}

/* ---------- Create Project Dialog ---------- */

function CreateProjectDialog({
  open, onOpenChange, onCreate, isPending,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (data: { name: string; description: string; status?: string; budget?: number; deadline?: string; tags?: string[] }) => void
  isPending: boolean
}) {
  const [name, setName] = useState('')
  const [showOptions, setShowOptions] = useState(false)
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState('planning')
  const [budget, setBudget] = useState('')
  const [deadline, setDeadline] = useState('')
  const [tagsInput, setTagsInput] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean)
    onCreate({
      name: name.trim(),
      description: description.trim(),
      status: status || undefined,
      budget: budget ? parseFloat(budget) : undefined,
      deadline: deadline || undefined,
      tags: tags.length > 0 ? tags : undefined,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="New Project">
      <form onSubmit={handleSubmit} className="space-y-3">
        <Input label="Name" autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="My New Project" />
        {!showOptions && (
          <button type="button" onClick={() => setShowOptions(true)} className="flex items-center gap-1 text-[11px] text-text-muted hover:text-accent transition-colors">
            <ChevronDown size={11} /> Show options
          </button>
        )}
        {showOptions && (
          <div className="space-y-3">
            <Textarea label="Description" value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="What is this project about?" />
            <Select label="Status" value={status} onValueChange={setStatus} options={[
              { value: 'planning', label: 'Planning' },
              { value: 'active', label: 'Active' },
              { value: 'paused', label: 'Paused' },
            ]} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Budget" type="number" step="0.01" min="0" value={budget} onChange={e => setBudget(e.target.value)} placeholder="0.00" />
              <Input label="Deadline" type="date" value={deadline} onChange={e => setDeadline(e.target.value)} />
            </div>
            <Input label="Tags (comma-separated)" value={tagsInput} onChange={e => setTagsInput(e.target.value)} placeholder="leather, commission" />
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" type="button" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" type="submit" disabled={!name.trim() || isPending}>
            {isPending ? 'Creating...' : 'Create'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

/* ========== Main Component ========== */

export function ProjectsView() {
  const [showCreate, setShowCreate] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sortBy, setSortBy] = useState('updated')
  const [tagFilter, setTagFilter] = useState('')
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['craftplanner', 'projects', { search, status: statusFilter }],
    queryFn: () => apiGet<Project[]>('/modules/craftplanner/projects', {
      ...(search ? { search } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
    }),
  })

  const createMutation = useMutation({
    mutationFn: (data: { name: string; description: string; status?: string; budget?: number; deadline?: string; tags?: string[] }) =>
      apiPost<{ id: number }>('/modules/craftplanner/projects', data),
    onSuccess: result => {
      void queryClient.invalidateQueries({ queryKey: ['craftplanner'] })
      setShowCreate(false)
      if (result?.id) navigate({ to: `/projects/${result.id}` as never })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiDelete(`/modules/craftplanner/projects/${id}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['craftplanner'] }),
  })

  // Collect all tags for filter chips
  const allTags = useMemo(() => {
    const set = new Set<string>()
    for (const p of projects) for (const t of p.tags) set.add(t)
    return Array.from(set).sort()
  }, [projects])

  const filtered = useMemo(() => {
    let list = projects
    if (tagFilter) list = list.filter(p => p.tags.includes(tagFilter))
    return sortProjects(list, sortBy)
  }, [projects, sortBy, tagFilter])

  return (
    <div className="p-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <h1 className="text-[22px] font-display text-text leading-tight">Projects</h1>
          <Badge variant="muted" size="sm">{projects.length}</Badge>
        </div>
        <Button variant="primary" size="xs" onClick={() => setShowCreate(true)}>
          <Plus size={10} /> New Project
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2.5 mb-4">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-faint pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search projects..."
            className="w-full h-7 pl-8 pr-3 rounded border bg-surface-el text-text text-[11px] border-border placeholder:text-text-faint focus:outline-none focus:border-accent/50 transition-colors"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter} options={STATUS_OPTIONS} placeholder="All statuses" className="min-w-[120px]" />
        <Select value={sortBy} onValueChange={setSortBy} options={SORT_OPTIONS} placeholder="Sort by" className="min-w-[120px]" />
      </div>

      {/* Tag filter chips */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-4">
          <button
            onClick={() => setTagFilter('')}
            className={cn(
              'px-2 h-5 rounded text-[9px] font-medium border transition-colors',
              !tagFilter
                ? 'bg-accent-dim text-accent border-accent/25'
                : 'bg-transparent text-text-faint border-border hover:text-text-muted',
            )}
          >
            All
          </button>
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => setTagFilter(tagFilter === tag ? '' : tag)}
              className={cn(
                'px-2 h-5 rounded text-[9px] font-medium border transition-colors',
                tagFilter === tag
                  ? 'bg-accent-dim text-accent border-accent/25'
                  : 'bg-transparent text-text-faint border-border hover:text-text-muted',
              )}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Project list */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-24 bg-surface rounded animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 bg-surface rounded border border-border">
          <FolderKanban size={28} className="mx-auto text-text-faint mb-3" />
          <p className="text-[13px] text-text-muted mb-1">No projects found.</p>
          <p className="text-[11px] text-text-faint">
            {search || statusFilter || tagFilter ? 'Try adjusting your filters.' : 'Create your first project to get started.'}
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map(project => {
            const days = project.deadline ? daysUntil(project.deadline) : null

            return (
              <Link
                key={project.id}
                to={`/projects/${project.id}` as never}
                className="block bg-surface border border-border rounded p-3.5 hover:border-accent/30 transition-colors group"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Name + status */}
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[13px] font-medium text-text group-hover:text-accent transition-colors truncate">
                        {project.name}
                      </span>
                      <Badge variant={STATUS_BADGE_VARIANT[project.status] || 'default'} size="sm" className="text-[9px]">
                        {project.status}
                      </Badge>
                    </div>

                    {/* Description */}
                    {project.description && (
                      <p className="text-[11px] text-text-muted line-clamp-1 mb-1.5">{project.description}</p>
                    )}

                    {/* Progress bar */}
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="flex-1 h-1 bg-border rounded-full overflow-hidden max-w-48">
                        <div
                          className={cn('h-full rounded-full transition-all', project.completion_pct >= 100 ? 'bg-success' : 'bg-accent')}
                          style={{ width: `${Math.min(project.completion_pct, 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-text-faint font-mono w-7 text-right">{Math.round(project.completion_pct)}%</span>
                    </div>

                    {/* Meta row */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-text-faint">
                      {project.budget != null && (
                        <span className="flex items-center gap-0.5 font-mono">
                          <DollarSign size={8} /> {formatCurrency(project.budget)}
                        </span>
                      )}
                      {days !== null && (
                        <span className={cn(
                          'flex items-center gap-0.5',
                          days < 0 ? 'text-danger' : days <= 7 ? 'text-warning' : 'text-text-faint',
                        )}>
                          <Calendar size={8} />
                          {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'due today' : `${days}d remaining`}
                        </span>
                      )}
                      <span>Updated {relativeDate(project.updated_at)}</span>
                    </div>

                    {/* Tags */}
                    {project.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {project.tags.map(tag => (
                          <Badge key={tag} variant="default" size="sm" className="text-[9px]">{tag}</Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Delete */}
                  <button
                    onClick={e => {
                      e.preventDefault()
                      e.stopPropagation()
                      if (confirm(`Delete "${project.name}"?`)) deleteMutation.mutate(project.id)
                    }}
                    className="p-1 text-text-faint hover:text-danger transition-colors opacity-0 group-hover:opacity-100 rounded hover:bg-danger/10 shrink-0"
                    aria-label="Delete project"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      <CreateProjectDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onCreate={data => createMutation.mutate(data)}
        isPending={createMutation.isPending}
      />
    </div>
  )
}
