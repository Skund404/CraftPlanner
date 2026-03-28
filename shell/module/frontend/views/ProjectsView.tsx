import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost, apiDelete } from '@/lib/api'
import { Link, useNavigate } from '@tanstack/react-router'
import { Plus, Search, Trash2, ChevronDown, FolderKanban } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardBody } from '@/components/ui/Card'
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

function relativeDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const diffWeeks = Math.floor(diffDays / 7)

  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffWeeks === 1) return '1 week ago'
  if (diffWeeks < 5) return `${diffWeeks} weeks ago`
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

function statusDuration(createdAt: string): string {
  const created = new Date(createdAt)
  const now = new Date()
  const diffMs = now.getTime() - created.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''}`
  const weeks = Math.floor(diffDays / 7)
  if (weeks < 5) return `${weeks} week${weeks !== 1 ? 's' : ''}`
  const months = Math.floor(diffDays / 30)
  return `${months} month${months !== 1 ? 's' : ''}`
}

/* ---------- Create Project Dialog ---------- */

function CreateProjectDialog({
  open,
  onOpenChange,
  onCreate,
  isPending,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (data: {
    name: string
    description: string
    status?: string
    budget?: number
    deadline?: string
    tags?: string[]
  }) => void
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
    const tags = tagsInput
      .split(',')
      .map(t => t.trim())
      .filter(Boolean)
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
        <Input
          label="Name"
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="My New Project"
        />

        {!showOptions && (
          <button
            type="button"
            onClick={() => setShowOptions(true)}
            className="flex items-center gap-1 text-xs text-text-muted hover:text-accent transition-colors"
          >
            <ChevronDown size={12} />
            Show options
          </button>
        )}

        {showOptions && (
          <div className="space-y-3">
            <Textarea
              label="Description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="What is this project about?"
            />
            <Select
              label="Status"
              value={status}
              onValueChange={setStatus}
              options={[
                { value: 'planning', label: 'Planning' },
                { value: 'active', label: 'Active' },
                { value: 'paused', label: 'Paused' },
              ]}
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
              value={tagsInput}
              onChange={e => setTagsInput(e.target.value)}
              placeholder="leather, commission"
            />
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" type="button" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
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
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  /* ---------- Queries ---------- */

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['craftplanner', 'projects', { search, status: statusFilter }],
    queryFn: () =>
      apiGet<Project[]>('/modules/craftplanner/projects', {
        ...(search ? { search } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
      }),
  })

  /* ---------- Mutations ---------- */

  const createMutation = useMutation({
    mutationFn: (data: {
      name: string
      description: string
      status?: string
      budget?: number
      deadline?: string
      tags?: string[]
    }) => apiPost<{ id: number }>('/modules/craftplanner/projects', data),
    onSuccess: result => {
      void queryClient.invalidateQueries({ queryKey: ['craftplanner'] })
      setShowCreate(false)
      if (result?.id) {
        navigate({ to: `/projects/${result.id}` as never })
      }
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiDelete(`/modules/craftplanner/projects/${id}`),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ['craftplanner'] }),
  })

  /* ---------- Derived ---------- */

  const sortedProjects = useMemo(
    () => sortProjects(projects, sortBy),
    [projects, sortBy],
  )

  /* ---------- Render ---------- */

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1
            className="text-2xl"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
          >
            Projects
          </h1>
          <Badge variant="muted">{projects.length}</Badge>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
          <Plus size={14} />
          New Project
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint pointer-events-none"
          />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search projects..."
            className={cn(
              'w-full h-8 pl-9 pr-3 rounded border bg-surface-el text-text text-sm',
              'border-border-bright placeholder:text-text-faint',
              'focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25',
              'transition-colors',
            )}
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={setStatusFilter}
          options={STATUS_OPTIONS}
          placeholder="All statuses"
          className="min-w-[140px]"
        />
        <Select
          value={sortBy}
          onValueChange={setSortBy}
          options={SORT_OPTIONS}
          placeholder="Sort by"
          className="min-w-[140px]"
        />
      </div>

      {/* Project list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-28 bg-surface rounded-lg animate-pulse" />
          ))}
        </div>
      ) : sortedProjects.length === 0 ? (
        <div className="text-center py-16 bg-surface rounded-lg border border-border">
          <FolderKanban size={32} className="mx-auto text-text-faint mb-3" />
          <p className="text-text-muted mb-1">No projects found.</p>
          <p className="text-xs text-text-faint">
            {search || statusFilter
              ? 'Try adjusting your filters.'
              : 'Create your first project to get started.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {sortedProjects.map(project => {
            const budgetStr =
              project.budget != null ? formatCurrency(project.budget) : null
            const deadlineStr = project.deadline
              ? new Date(project.deadline).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })
              : null

            return (
              <Link
                key={project.id}
                to={`/projects/${project.id}` as never}
                className="block bg-surface border border-border rounded-lg p-4 hover:border-accent/30 transition-colors group"
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Left: content */}
                  <div className="flex-1 min-w-0">
                    {/* Row 1: Name + completion */}
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-sm font-medium text-text group-hover:text-accent transition-colors truncate">
                        {project.name}
                      </span>
                    </div>

                    {/* Row 2: Description */}
                    {project.description && (
                      <p className="text-xs text-text-muted line-clamp-1 mb-2">
                        {project.description}
                      </p>
                    )}

                    {/* Row 3: Status + budget */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-faint">
                      <Badge
                        variant={STATUS_BADGE_VARIANT[project.status] || 'default'}
                        className="text-[10px]"
                      >
                        {project.status}
                      </Badge>
                      <span className="text-text-faint">
                        {statusDuration(project.created_at)}
                      </span>
                      {budgetStr && <span>Budget: {budgetStr}</span>}
                      {deadlineStr && <span>Due: {deadlineStr}</span>}
                    </div>

                    {/* Row 4: Tags */}
                    {project.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {project.tags.map(tag => (
                          <Badge key={tag} variant="default" className="text-[10px]">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Right: completion + actions */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-border rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all',
                            project.completion_pct >= 100
                              ? 'bg-success'
                              : 'bg-accent',
                          )}
                          style={{
                            width: `${Math.min(project.completion_pct, 100)}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs text-text-faint w-8 text-right">
                        {Math.round(project.completion_pct)}%
                      </span>
                    </div>
                    <button
                      onClick={e => {
                        e.preventDefault()
                        e.stopPropagation()
                        if (confirm(`Delete "${project.name}"?`)) {
                          deleteMutation.mutate(project.id)
                        }
                      }}
                      className="p-1.5 text-text-faint hover:text-danger transition-colors opacity-0 group-hover:opacity-100 rounded hover:bg-danger/10"
                      aria-label="Delete project"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* Create Dialog */}
      <CreateProjectDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onCreate={data => createMutation.mutate(data)}
        isPending={createMutation.isPending}
      />
    </div>
  )
}
