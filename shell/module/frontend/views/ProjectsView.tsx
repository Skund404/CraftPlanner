import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost, apiDelete } from '@/lib/api'
import { Link } from '@tanstack/react-router'
import { Plus, Trash2, Search } from 'lucide-react'

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

const STATUS_COLORS: Record<string, string> = {
  planning: 'bg-text-muted/20 text-text-muted',
  active: 'bg-accent/15 text-accent',
  paused: 'bg-warning/15 text-warning',
  completed: 'bg-success/15 text-success',
  archived: 'bg-text-faint/20 text-text-faint',
}

function CreateProjectDialog({ onClose, onCreate }: {
  onClose: () => void
  onCreate: (data: { name: string; description: string; budget?: number }) => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [budget, setBudget] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    onCreate({
      name: name.trim(),
      description: description.trim(),
      budget: budget ? parseFloat(budget) : undefined,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <form
        onClick={e => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="bg-surface border border-border rounded-lg p-6 w-full max-w-md shadow-xl"
      >
        <h2 className="text-lg font-medium text-text mb-4">New Project</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-text-muted block mb-1">Name</label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-bg border border-border rounded px-3 py-2 text-sm text-text focus:outline-none focus:border-accent"
              placeholder="My New Project"
            />
          </div>
          <div>
            <label className="text-xs text-text-muted block mb-1">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full bg-bg border border-border rounded px-3 py-2 text-sm text-text focus:outline-none focus:border-accent resize-none"
              rows={3}
              placeholder="What is this project about?"
            />
          </div>
          <div>
            <label className="text-xs text-text-muted block mb-1">Budget (optional)</label>
            <input
              type="number"
              step="0.01"
              value={budget}
              onChange={e => setBudget(e.target.value)}
              className="w-full bg-bg border border-border rounded px-3 py-2 text-sm text-text focus:outline-none focus:border-accent"
              placeholder="0.00"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-text-muted hover:text-text transition-colors rounded"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim()}
            className="px-4 py-1.5 text-sm bg-accent text-bg rounded hover:bg-accent/90 transition-colors disabled:opacity-40"
          >
            Create
          </button>
        </div>
      </form>
    </div>
  )
}

export function ProjectsView() {
  const [showCreate, setShowCreate] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const queryClient = useQueryClient()

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['craftplanner', 'projects', { search, status: statusFilter }],
    queryFn: () => apiGet<Project[]>('/modules/craftplanner/projects', {
      ...(search ? { search } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
    }),
  })

  const createMutation = useMutation({
    mutationFn: (data: { name: string; description: string; budget?: number }) =>
      apiPost('/modules/craftplanner/projects', data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['craftplanner'] })
      setShowCreate(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiDelete(`/modules/craftplanner/projects/${id}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['craftplanner'] }),
  })

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-3xl mb-1"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
          >
            Projects
          </h1>
          <p className="text-sm text-text-muted">{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-accent text-bg rounded hover:bg-accent/90 transition-colors"
        >
          <Plus size={14} />
          New Project
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search projects..."
            className="w-full bg-surface border border-border rounded pl-9 pr-3 py-1.5 text-sm text-text focus:outline-none focus:border-accent"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="bg-surface border border-border rounded px-3 py-1.5 text-sm text-text focus:outline-none focus:border-accent"
        >
          <option value="">All statuses</option>
          <option value="planning">Planning</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="completed">Completed</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {/* Project list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-20 bg-surface rounded-lg animate-pulse" />)}
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-12 bg-surface rounded-lg border border-border">
          <p className="text-text-muted">No projects found.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {projects.map(project => (
            <Link
              key={project.id}
              to={`/projects/${project.id}` as never}
              className="block bg-surface border border-border rounded-lg p-4 hover:border-accent/30 transition-colors group"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-text group-hover:text-accent transition-colors truncate">
                      {project.name}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${STATUS_COLORS[project.status] || ''}`}>
                      {project.status}
                    </span>
                  </div>
                  {project.description && (
                    <p className="text-xs text-text-muted line-clamp-1">{project.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-[10px] text-text-faint">
                    {project.budget != null && <span>Budget: ${project.budget.toLocaleString()}</span>}
                    {project.deadline && <span>Due: {project.deadline}</span>}
                    {project.tags.length > 0 && (
                      <span>{project.tags.join(', ')}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  {/* Completion bar */}
                  <div className="w-16 h-1.5 bg-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-full transition-all"
                      style={{ width: `${project.completion_pct}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-text-faint w-8 text-right">
                    {Math.round(project.completion_pct)}%
                  </span>
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      if (confirm(`Delete "${project.name}"?`)) {
                        deleteMutation.mutate(project.id)
                      }
                    }}
                    className="p-1 text-text-faint hover:text-danger transition-colors opacity-0 group-hover:opacity-100"
                    aria-label="Delete project"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateProjectDialog
          onClose={() => setShowCreate(false)}
          onCreate={data => createMutation.mutate(data)}
        />
      )}
    </div>
  )
}
