import { useState, type ReactNode } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  FolderKanban,
  DollarSign,
  Clock,
  Plus,
  ArrowRight,
  Calendar,
  TrendingUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardBody } from '@/components/ui/Card'
import { Dialog } from '@/components/ui/Dialog'
import { Input, Textarea } from '@/components/ui/Input'

/* ---------- Types ---------- */

interface DashboardData {
  total_projects: number
  by_status: Record<string, number>
  total_budget: number
  total_spent: number
}

interface DashboardProject {
  id: number
  name: string
  status: string
  budget: number | null
  deadline: string | null
  completion_pct: number
  updated_at: string
}

interface Activity {
  activity_type: 'time_log' | 'cost_entry'
  activity_date: string
  project_name: string
  // time_log fields
  minutes?: number
  item_name?: string
  note?: string
  // cost_entry fields
  amount?: number
  description?: string
  category?: string
}

interface DashboardEvent {
  id: number
  name: string
  event_date: string | null
  location: string
}

/* ---------- Helpers ---------- */

function formatTime(min: number): string {
  if (min < 60) return `${min}m`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function formatCurrency(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function daysUntil(dateStr: string): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const target = new Date(dateStr)
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

function todayString(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function relativeDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const yesterday = new Date(todayStart)
  yesterday.setDate(yesterday.getDate() - 1)

  if (date >= todayStart) return 'today'
  if (date >= yesterday) return 'yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/* ---------- Sub-components ---------- */

function StatCard({
  icon,
  label,
  value,
  subtext,
}: {
  icon: ReactNode
  label: string
  value: string
  subtext?: string
}) {
  return (
    <Card>
      <CardBody>
        <div className="flex items-center gap-1.5 text-xs text-text-muted mb-1">
          {icon}
          {label}
        </div>
        <div className="text-2xl font-semibold text-text">{value}</div>
        {subtext && <div className="text-[10px] text-text-faint mt-1">{subtext}</div>}
      </CardBody>
    </Card>
  )
}

function StatusBar({ byStatus }: { byStatus: Record<string, number> }) {
  const statuses = [
    { key: 'planning', label: 'Planning', color: 'bg-text-muted' },
    { key: 'active', label: 'Active', color: 'bg-accent' },
    { key: 'paused', label: 'Paused', color: 'bg-warning' },
    { key: 'completed', label: 'Completed', color: 'bg-success' },
    { key: 'archived', label: 'Archived', color: 'bg-text-faint' },
  ]
  const total = Object.values(byStatus).reduce((a, b) => a + b, 0)
  if (total === 0) return null

  return (
    <div className="mb-6">
      <div className="flex gap-0.5 h-2.5 rounded-full overflow-hidden mb-2">
        {statuses.map(s => {
          const count = byStatus[s.key] || 0
          if (count === 0) return null
          return (
            <div
              key={s.key}
              className={`${s.color} transition-all`}
              style={{ width: `${(count / total) * 100}%` }}
              title={`${s.label}: ${count}`}
            />
          )
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {statuses.map(s => {
          const count = byStatus[s.key] || 0
          if (count === 0) return null
          return (
            <div key={s.key} className="flex items-center gap-1.5 text-xs text-text-muted">
              <div className={`w-2 h-2 rounded-full ${s.color}`} />
              <span>{s.label}</span>
              <span className="text-text-faint">{count}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ActivityFeedItem({ entry }: { entry: Activity }) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <div
        className={cn(
          'mt-0.5 w-5 h-5 rounded flex items-center justify-center shrink-0',
          entry.activity_type === 'time_log'
            ? 'bg-accent/10 text-accent'
            : 'bg-warning/10 text-warning',
        )}
      >
        {entry.activity_type === 'time_log' ? (
          <Clock size={10} />
        ) : (
          <DollarSign size={10} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        {entry.activity_type === 'time_log' ? (
          <span className="text-text">
            <span className="font-medium">{formatTime(entry.minutes ?? 0)}</span>
            {entry.item_name && (
              <>
                {' on '}
                <span className="text-text-muted">{entry.item_name}</span>
              </>
            )}
            {entry.note && !entry.item_name && (
              <>
                {' \u2014 '}
                <span className="text-text-muted">{entry.note}</span>
              </>
            )}
            {' \u00b7 '}
            <span className="text-text-faint">{entry.project_name}</span>
          </span>
        ) : (
          <span className="text-text">
            <span className="font-medium">{formatCurrency(entry.amount ?? 0)}</span>
            {entry.description && (
              <>
                {' \u00b7 '}
                <span className="text-text-muted">{entry.description}</span>
              </>
            )}
            {' \u00b7 '}
            <span className="text-text-faint">{entry.project_name}</span>
          </span>
        )}
      </div>
      <span className="text-[10px] text-text-faint shrink-0">
        {relativeDate(entry.activity_date)}
      </span>
    </div>
  )
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
  onCreate: (data: { name: string; description: string; budget?: number; deadline?: string }) => void
  isPending: boolean
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [budget, setBudget] = useState('')
  const [deadline, setDeadline] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    onCreate({
      name: name.trim(),
      description: description.trim(),
      budget: budget ? parseFloat(budget) : undefined,
      deadline: deadline || undefined,
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
        <Textarea
          label="Description (optional)"
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={2}
          placeholder="What is this project about?"
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Budget (optional)"
            type="number"
            step="0.01"
            min="0"
            value={budget}
            onChange={e => setBudget(e.target.value)}
            placeholder="0.00"
          />
          <Input
            label="Deadline (optional)"
            type="date"
            value={deadline}
            onChange={e => setDeadline(e.target.value)}
          />
        </div>
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

export function DashboardView() {
  const [showCreate, setShowCreate] = useState(false)
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  /* ---------- Queries ---------- */

  const { data: dashboard, isLoading: dashLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => apiGet<DashboardData>('/modules/craftplanner/projects/dashboard'),
  })

  const { data: activeProjects = [] } = useQuery({
    queryKey: ['active-projects'],
    queryFn: () =>
      apiGet<DashboardProject[]>('/modules/craftplanner/projects', { status: 'active' }),
  })

  const { data: recentActivity = [] } = useQuery({
    queryKey: ['dashboard-activity'],
    queryFn: () =>
      apiGet<Activity[]>('/modules/craftplanner/dashboard/activity', { limit: '10' }),
  })

  const { data: allEvents = [] } = useQuery({
    queryKey: ['events'],
    queryFn: () => apiGet<DashboardEvent[]>('/modules/craftplanner/events'),
  })

  /* ---------- Mutations ---------- */

  const createMutation = useMutation({
    mutationFn: (data: {
      name: string
      description: string
      budget?: number
      deadline?: string
    }) => apiPost<{ id: number }>('/modules/craftplanner/projects', data),
    onSuccess: result => {
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      void queryClient.invalidateQueries({ queryKey: ['active-projects'] })
      setShowCreate(false)
      if (result?.id) {
        navigate({ to: `/projects/${result.id}` as never })
      }
    },
  })

  /* ---------- Derived ---------- */

  const stats = dashboard ?? {
    total_projects: 0,
    by_status: {},
    total_budget: 0,
    total_spent: 0,
  }
  const activeCount = stats.by_status.active || 0
  const spentPct =
    stats.total_budget > 0
      ? Math.round((stats.total_spent / stats.total_budget) * 100)
      : 0

  // Upcoming events (date >= today)
  const today = new Date().toISOString().slice(0, 10)
  const upcomingEvents = allEvents
    .filter(e => e.event_date && e.event_date >= today)
    .sort((a, b) => (a.event_date ?? '').localeCompare(b.event_date ?? ''))

  // Projects with deadlines, sorted nearest first
  const deadlineProjects = activeProjects
    .filter(p => p.deadline)
    .sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? ''))

  // Active projects with budgets for the health section
  const budgetProjects = activeProjects.filter(p => p.budget && p.budget > 0)

  /* ---------- Loading ---------- */

  if (dashLoading) {
    return (
      <div className="p-6 max-w-5xl">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-surface rounded" />
          <div className="h-4 w-32 bg-surface rounded" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-surface rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  /* ---------- Render ---------- */

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1
            className="text-2xl mb-0.5"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
          >
            Dashboard
          </h1>
          <p className="text-xs text-text-faint">{todayString()}</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
          <Plus size={14} />
          New Project
        </Button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={<FolderKanban size={12} />}
          label="Active Projects"
          value={String(activeCount)}
          subtext={`${stats.total_projects} total`}
        />
        <StatCard
          icon={<DollarSign size={12} />}
          label="Total Budget"
          value={formatCurrency(stats.total_budget)}
          subtext={`across ${stats.total_projects} project${stats.total_projects !== 1 ? 's' : ''}`}
        />
        <StatCard
          icon={<TrendingUp size={12} />}
          label="Total Spent"
          value={formatCurrency(stats.total_spent)}
          subtext={stats.total_budget > 0 ? `${spentPct}% of budget` : undefined}
        />
        <StatCard
          icon={<Clock size={12} />}
          label="Time This Week"
          value={'\u2014'}
          subtext="no weekly aggregation"
        />
      </div>

      {/* Status Distribution Bar */}
      <StatusBar byStatus={stats.by_status} />

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left column */}
        <div className="space-y-4">
          {/* Active Projects */}
          <Card>
            <CardBody>
              <div className="text-xs font-medium text-text-muted mb-3">Active Projects</div>
              {activeProjects.length === 0 ? (
                <p className="text-sm text-text-faint py-4 text-center">
                  No active projects.
                </p>
              ) : (
                <div className="space-y-1">
                  {activeProjects.map(project => (
                    <Link
                      key={project.id}
                      to={`/projects/${project.id}` as never}
                      className="flex items-center gap-3 p-2.5 rounded-md hover:bg-bg/50 transition-colors group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-text group-hover:text-accent transition-colors truncate">
                            {project.name}
                          </span>
                          <span className="text-xs text-text-faint shrink-0 ml-2">
                            {Math.round(project.completion_pct)}%
                          </span>
                        </div>
                        <div className="h-1.5 bg-border rounded-full overflow-hidden mb-1">
                          <div
                            className="h-full bg-accent rounded-full transition-all"
                            style={{ width: `${project.completion_pct}%` }}
                          />
                        </div>
                        <div className="text-[10px] text-text-faint">
                          Updated {relativeDate(project.updated_at)}
                        </div>
                      </div>
                      <ArrowRight
                        size={12}
                        className="text-text-faint opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      />
                    </Link>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardBody>
              <div className="text-xs font-medium text-text-muted mb-3">Recent Activity</div>
              {recentActivity.length === 0 ? (
                <p className="text-sm text-text-faint py-4 text-center">
                  No recent activity.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {recentActivity.map((entry, i) => (
                    <ActivityFeedItem key={i} entry={entry} />
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Upcoming */}
          <Card>
            <CardBody>
              <div className="text-xs font-medium text-text-muted mb-3">Upcoming</div>

              {/* Deadlines */}
              {deadlineProjects.length > 0 && (
                <div className="mb-3">
                  <div className="text-[10px] uppercase tracking-wider text-text-faint mb-2">
                    Deadlines
                  </div>
                  <div className="space-y-1.5">
                    {deadlineProjects.map(project => {
                      const days = daysUntil(project.deadline!)
                      const overdue = days < 0
                      return (
                        <Link
                          key={project.id}
                          to={`/projects/${project.id}` as never}
                          className="flex items-center justify-between py-1 hover:bg-bg/50 rounded px-1.5 transition-colors"
                        >
                          <span className="text-xs text-text truncate">
                            {project.name}
                          </span>
                          <span
                            className={cn(
                              'text-[10px] shrink-0 ml-2',
                              overdue
                                ? 'text-danger'
                                : days <= 7
                                  ? 'text-warning'
                                  : 'text-text-faint',
                            )}
                          >
                            {overdue ? `${Math.abs(days)}d overdue` : `${days}d`}
                          </span>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Events */}
              {upcomingEvents.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-text-faint mb-2">
                    Events
                  </div>
                  <div className="space-y-1.5">
                    {upcomingEvents.map(event => (
                      <div
                        key={event.id}
                        className="flex items-center justify-between py-1 px-1.5"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Calendar size={10} className="text-text-faint shrink-0" />
                          <span className="text-xs text-text truncate">{event.name}</span>
                        </div>
                        <span className="text-[10px] text-text-faint shrink-0 ml-2">
                          {new Date(event.event_date!).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {deadlineProjects.length === 0 && upcomingEvents.length === 0 && (
                <p className="text-sm text-text-faint py-4 text-center">
                  Nothing upcoming.
                </p>
              )}
            </CardBody>
          </Card>

          {/* Budget Health */}
          <Card>
            <CardBody>
              <div className="text-xs font-medium text-text-muted mb-3">Budget Health</div>
              {budgetProjects.length === 0 ? (
                <p className="text-sm text-text-faint py-4 text-center">
                  No active projects with budgets.
                </p>
              ) : (
                <div className="space-y-3">
                  {budgetProjects.map(project => {
                    const budget = project.budget!
                    // We rely on the dashboard total_spent being distributed;
                    // individual project spent isn't available in the list endpoint,
                    // so we estimate from completion_pct * budget as a visual indicator
                    const estimatedSpent = (project.completion_pct / 100) * budget
                    const pct = Math.min(
                      Math.round((estimatedSpent / budget) * 100),
                      100,
                    )
                    const overBudget = estimatedSpent > budget

                    return (
                      <Link
                        key={project.id}
                        to={`/projects/${project.id}` as never}
                        className="block hover:bg-bg/30 rounded px-1 -mx-1 py-0.5 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-text truncate">
                            {project.name}
                          </span>
                          <span className="text-[10px] text-text-faint shrink-0 ml-2">
                            {formatCurrency(budget)}
                          </span>
                        </div>
                        <div className="h-1.5 bg-border rounded-full overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all',
                              overBudget
                                ? 'bg-danger'
                                : pct > 80
                                  ? 'bg-warning'
                                  : 'bg-accent',
                            )}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Empty state for zero projects */}
      {stats.total_projects === 0 && (
        <div className="mt-8 text-center py-12 bg-surface rounded-lg border border-border">
          <FolderKanban size={32} className="mx-auto text-text-faint mb-3" />
          <p className="text-text-muted mb-2">No projects yet.</p>
          <button
            onClick={() => setShowCreate(true)}
            className="text-sm text-accent hover:underline"
          >
            Create your first project
          </button>
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
